mod domain;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Northstar");
}

#[cfg(test)]
mod tests {
    use super::domain::{apply_week_change, DomainState, WeekChange, WeekChangeAction, WeekChangeType};

    #[test]
    fn same_request_is_idempotent() {
        let mut state = DomainState::demo();
        let request = WeekChange {
            schema_version: 1,
            request_id: "r1".into(),
            base_version: state.version,
            plan_id: state.plan_id.clone(),
            reason: "test".into(),
            actions: vec![WeekChangeAction { kind: WeekChangeType::Schedule, task_id: "t-next".into(), date: Some(state.start.clone()), rank: 2 }],
        };
        let first = apply_week_change(&mut state, request.clone()).expect("first request");
        let replay = apply_week_change(&mut state, request).expect("replay");
        assert!(!first.replayed);
        assert!(replay.replayed);
        assert_eq!(state.audit_count, 1);
    }
}
