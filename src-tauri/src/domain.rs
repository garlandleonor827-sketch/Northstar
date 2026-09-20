//! Rust authorization boundary for the Tauri build.
//!
//! The Vite local-development shell calls the equivalent TypeScript service so
//! it can run without Cargo. The desktop build keeps the same invariants here:
//! model output is a candidate, while this module owns permission, version,
//! capacity, protected facts and idempotent receipts.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use thiserror::Error;

#[derive(Debug, Error, PartialEq)]
pub enum DomainError {
    #[error("shape")]
    Shape,
    #[error("id reused")]
    IdReused,
    #[error("not authorized")]
    NotAuthorized,
    #[error("stale")]
    Stale,
    #[error("capacity")]
    Capacity,
    #[error("protected")]
    Protected,
    #[error("unknown task")]
    UnknownTask,
    #[error("out of week")]
    OutOfWeek,
    #[error("dependency")]
    Dependency,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub minutes: u32,
    pub date: Option<String>,
    pub rank: u32,
    pub pinned: bool,
    pub completed: bool,
    pub hard_due: Option<String>,
    pub dependencies: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum WeekChangeType { Schedule, Unschedule }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WeekChangeAction {
    pub kind: WeekChangeType,
    pub task_id: String,
    pub date: Option<String>,
    pub rank: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WeekChange {
    pub schema_version: u8,
    pub request_id: String,
    pub base_version: u64,
    pub plan_id: String,
    pub reason: String,
    pub actions: Vec<WeekChangeAction>,
}

#[derive(Clone, Debug)]
pub struct Receipt { pub request: String, pub version: u64, pub scheduled_minutes: u32 }

#[derive(Clone, Debug)]
pub struct DomainState {
    pub plan_id: String,
    pub start: String,
    pub end: String,
    pub version: u64,
    pub capacity_minutes: u32,
    pub auto_adjust: bool,
    pub primary_count: u8,
    pub tasks: Vec<Task>,
    pub receipts: HashMap<String, Receipt>,
    pub audit_count: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ApplyResult { pub version: u64, pub scheduled_minutes: u32, pub replayed: bool }

impl DomainState {
    pub fn demo() -> Self {
        Self {
            plan_id: "plan-current-cycle".into(), start: "2026-09-21".into(), end: "2026-09-27".into(), version: 4,
            capacity_minutes: 600, auto_adjust: true, primary_count: 1,
            tasks: vec![
                Task { id: "t-responsibility".into(), minutes: 90, date: Some("2026-09-23".into()), rank: 0, pinned: true, completed: false, hard_due: Some("2026-09-24".into()), dependencies: vec![] },
                Task { id: "t-next".into(), minutes: 60, date: None, rank: 0, pinned: false, completed: false, hard_due: None, dependencies: vec![] },
            ], receipts: HashMap::new(), audit_count: 0,
        }
    }
}

fn request_fingerprint(request: &WeekChange) -> String {
    serde_json::to_string(request).expect("domain request is serializable")
}

fn scheduled_minutes(tasks: &[Task]) -> u32 { tasks.iter().filter(|task| task.date.is_some() && !task.completed).map(|task| task.minutes).sum() }

pub fn apply_week_change(state: &mut DomainState, request: WeekChange) -> Result<ApplyResult, DomainError> {
    if request.schema_version != 1 || request.request_id.is_empty() || request.plan_id.is_empty() || request.reason.is_empty() || request.actions.is_empty() || request.actions.len() > 20 { return Err(DomainError::Shape); }
    let fingerprint = request_fingerprint(&request);
    if let Some(receipt) = state.receipts.get(&request.request_id) {
        if receipt.request != fingerprint { return Err(DomainError::IdReused); }
        return Ok(ApplyResult { version: receipt.version, scheduled_minutes: receipt.scheduled_minutes, replayed: true });
    }
    if !state.auto_adjust { return Err(DomainError::NotAuthorized); }
    if state.plan_id != request.plan_id || state.version != request.base_version || state.primary_count > 1 { return Err(DomainError::Stale); }
    let mut next = state.tasks.clone();
    let mut seen = HashSet::new();
    for action in &request.actions {
        if !seen.insert(action.task_id.clone()) { return Err(DomainError::Shape); }
        let task = next.iter_mut().find(|task| task.id == action.task_id).ok_or(DomainError::UnknownTask)?;
        if task.pinned || task.completed { return Err(DomainError::Protected); }
        match action.kind {
            WeekChangeType::Schedule => {
                let date = action.date.as_ref().ok_or(DomainError::Shape)?;
                if date < &state.start || date > &state.end { return Err(DomainError::OutOfWeek); }
                if task.hard_due.as_ref().is_some_and(|due| date > due) { return Err(DomainError::Protected); }
                task.date = Some(date.clone());
            }
            WeekChangeType::Unschedule => {
                if action.date.is_some() || task.hard_due.is_some() { return Err(DomainError::Protected); }
                task.date = None;
            }
        }
        task.rank = action.rank;
    }
    let minutes = scheduled_minutes(&next);
    if minutes > state.capacity_minutes { return Err(DomainError::Capacity); }
    for task in next.iter().filter(|task| task.date.is_some() && !task.completed) {
        for dependency_id in &task.dependencies {
            let dependency = next.iter().find(|candidate| &candidate.id == dependency_id).ok_or(DomainError::Dependency)?;
            if !dependency.completed && dependency.date.as_ref().is_none_or(|date| date > task.date.as_ref().unwrap()) { return Err(DomainError::Dependency); }
        }
    }
    state.tasks = next;
    state.version += 1;
    state.audit_count += 1;
    state.receipts.insert(request.request_id, Receipt { request: fingerprint, version: state.version, scheduled_minutes: minutes });
    Ok(ApplyResult { version: state.version, scheduled_minutes: minutes, replayed: false })
}
