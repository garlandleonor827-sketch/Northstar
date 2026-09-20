import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Theme } from '../lib/domain';

export type CoreStatus = 'focused' | 'flow' | 'drifting' | 'overloaded' | 'recovering' | 'dormant' | 'unknown';

interface Props {
  theme: Theme;
  stage: number;
  status: CoreStatus;
  reducedMotion: boolean;
  compact?: boolean;
  onOpenSession?: () => void;
}

const statusText: Record<CoreStatus, string> = {
  focused: '状态稳定 · 当前计划已确认',
  flow: '顺势推进 · 能量沿轨道流动',
  drifting: '轨道偏移 · 依据待复核',
  overloaded: '容量收束 · 建议减少动作',
  recovering: '恢复模式 · 只保留必要事项',
  dormant: '低活动 · 形态保持',
  unknown: '数据不足 · 保持中性'
};

const statusLabel: Record<CoreStatus, string> = {
  focused: 'FOCUSED',
  flow: 'FLOW',
  drifting: 'DRIFTING',
  overloaded: 'OVERLOADED',
  recovering: 'RECOVERING',
  dormant: 'DORMANT',
  unknown: 'UNKNOWN'
};

const stageNames = ['Seed', 'Orbit', 'Resonance', 'Constellation', 'Northstar', 'Aurora', 'Continuum'];
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function clampStage(stage: number): number {
  return Math.max(1, Math.min(7, Math.round(stage || 1)));
}

function createGlowTexture(color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.2, color.replace('1)', '0.55)'));
  gradient.addColorStop(1, color.replace('1)', '0)'));
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  return new THREE.CanvasTexture(canvas);
}

export function NorthstarCore({ theme, stage, status, reducedMotion, compact = false, onOpenSession }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const motionPreference = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  const shouldReduce = reducedMotion || motionPreference;
  const safeStage = clampStage(stage);
  const fallbackAsset = theme === 'dark' ? (safeStage >= 3 ? '/assets/core/core-stage3-reference.png' : '/assets/core/core-fallback-orbit.png') : '/assets/core/core-fallback-light.png';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || shouldReduce) {
      setFallback(true);
      return undefined;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      setFallback(true);
      return undefined;
    }

    setFallback(false);
    const device = navigator as Navigator & { deviceMemory?: number };
    const lowPerformance = (navigator.hardwareConcurrency || 8) <= 4 || (device.deviceMemory ?? 8) <= 4;
    const qualityScale = compact ? 0.7 : 1;
    const complexity = Math.max(1, Math.min(4, Math.ceil(safeStage / 2)));
    const orbitCount = Math.max(2, Math.min(5, Math.round((safeStage + 1) * qualityScale)));
    const particleBudget = lowPerformance ? 48 : Math.round((82 + safeStage * 22) * qualityScale);
    const accent = theme === 'dark' ? 0x9bdcff : 0x1d6594;
    const bright = theme === 'dark' ? 0xd9f3ff : 0x8bc7ef;
    const warm = status === 'overloaded' ? 0xffb18c : bright;
    const statusSpeed: Record<CoreStatus, number> = { focused: 1, flow: 1.55, drifting: 0.75, overloaded: 1.08, recovering: 0.38, dormant: 0.12, unknown: 0.04 };
    const speed = statusSpeed[status];

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
    camera.position.set(0, 0.1, 5.1);

    const root = new THREE.Group();
    scene.add(root);

    scene.add(new THREE.AmbientLight(accent, theme === 'dark' ? 1.2 : 0.9));
    const key = new THREE.PointLight(warm, theme === 'dark' ? 3.8 : 2.5, 8);
    key.position.set(1.1, 1.25, 2.1);
    scene.add(key);
    const fill = new THREE.PointLight(accent, 1.5, 8);
    fill.position.set(-2.1, -1.1, 1.2);
    scene.add(fill);

    const coreGeometry = new THREE.IcosahedronGeometry(0.74 + safeStage * 0.015, complexity + 1);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: bright,
      emissive: theme === 'dark' ? 0x1f5c96 : 0x143e62,
      emissiveIntensity: theme === 'dark' ? 1.6 : 0.68,
      metalness: 0.78,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
      clearcoat: 0.9,
      clearcoatRoughness: 0.2
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    root.add(core);

    const edgeMaterial = new THREE.MeshBasicMaterial({ color: bright, transparent: true, opacity: 0.26, wireframe: true });
    const edgeCore = new THREE.Mesh(coreGeometry.clone(), edgeMaterial);
    edgeCore.scale.setScalar(1.04);
    root.add(edgeCore);

    const innerGeometry = new THREE.SphereGeometry(0.27 + safeStage * 0.008, 28, 28);
    const innerMaterial = new THREE.MeshBasicMaterial({ color: theme === 'dark' ? 0xe8f8ff : 0x2776a6, transparent: true, opacity: 0.9 });
    const inner = new THREE.Mesh(innerGeometry, innerMaterial);
    root.add(inner);

    const haloTexture = createGlowTexture(theme === 'dark' ? 'rgba(110, 205, 255, 1)' : 'rgba(55, 135, 195, 1)');
    const haloMaterial = new THREE.SpriteMaterial({ map: haloTexture, color: bright, transparent: true, opacity: theme === 'dark' ? 0.42 : 0.2, depthWrite: false });
    const halo = new THREE.Sprite(haloMaterial);
    halo.scale.set(3.35, 3.35, 1);
    root.add(halo);

    const rings: THREE.Mesh[] = [];
    for (let index = 0; index < orbitCount; index += 1) {
      const radius = 1.04 + index * 0.12;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, index === 0 ? 0.016 : 0.009, 8, 144),
        new THREE.MeshBasicMaterial({ color: index % 2 === 0 ? bright : accent, transparent: true, opacity: index === 0 ? 0.78 : 0.4 })
      );
      ring.rotation.set(0.38 + index * 0.32, index * 0.5, index * 0.22);
      root.add(ring);
      rings.push(ring);
    }

    const orbitGroups: THREE.Group[] = [];
    const orbitParticleGeometries: THREE.BufferGeometry[] = [];
    const orbitParticleMaterials: THREE.PointsMaterial[] = [];
    const orbitLines: THREE.Line[] = [];
    const nodeGeometry = new THREE.SphereGeometry(0.038, 10, 10);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: bright, transparent: true, opacity: 0.9 });
    const nodeMeshes: THREE.Mesh[] = [];

    for (let index = 0; index < Math.min(orbitCount, 4); index += 1) {
      const group = new THREE.Group();
      group.rotation.set(0.2 + index * 0.34, index * 0.48, index * 0.18);
      root.add(group);
      orbitGroups.push(group);

      const radiusX = 1.32 + index * 0.13;
      const radiusZ = 0.76 + index * 0.11;
      const points = new THREE.EllipseCurve(0, 0, radiusX, radiusZ, 0, Math.PI * 2, false, 0).getPoints(128).map((point) => new THREE.Vector3(point.x, 0, point.y));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: index % 2 ? accent : bright, transparent: true, opacity: 0.22 + (index === 0 ? 0.12 : 0) }));
      group.add(line);
      orbitLines.push(line);

      const count = Math.max(8, Math.round((particleBudget / Math.max(1, orbitCount)) * (index === 0 ? 1.25 : 0.72)));
      const positions = new Float32Array(count * 3);
      const phases: number[] = [];
      for (let particle = 0; particle < count; particle += 1) {
        phases.push((particle / count) * Math.PI * 2 + index * 0.8);
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particleGeometry.userData = { phases, radiusX, radiusZ, index };
      const particleMaterial = new THREE.PointsMaterial({ color: bright, size: lowPerformance ? 0.027 : 0.034, transparent: true, opacity: status === 'flow' ? 0.8 : 0.54, depthWrite: false });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      group.add(particles);
      orbitParticleGeometries.push(particleGeometry);
      orbitParticleMaterials.push(particleMaterial);

      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.userData = { phase: index * 1.6, radiusX, radiusZ, index };
      group.add(node);
      nodeMeshes.push(node);
    }

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const width = Math.max(1, parent.clientWidth);
      const height = Math.max(1, parent.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    let frame = 0;
    const started = performance.now();
    const animate = (time: number) => {
      if (document.visibilityState !== 'hidden') {
        const seconds = (time - started) / 1000;
        const breath = 1 + Math.sin(seconds * (status === 'recovering' ? 0.38 : 0.72) * speed) * (status === 'overloaded' ? 0.045 : 0.065);
        core.scale.setScalar(breath);
        edgeCore.scale.setScalar(1.04 * breath);
        inner.scale.setScalar(1 + Math.sin(seconds * 0.82 * speed) * 0.1);
        halo.scale.setScalar(3.35 + Math.sin(seconds * 0.55 * speed) * 0.12);
        core.rotation.x = seconds * 0.08 * speed;
        core.rotation.y = seconds * 0.13 * speed;
        edgeCore.rotation.x = -seconds * 0.045 * speed;
        edgeCore.rotation.y = seconds * 0.072 * speed;
        rings.forEach((ring, ringIndex) => {
          ring.rotation.x += 0.00055 * (ringIndex + 1) * speed;
          ring.rotation.z -= 0.00038 * (ringIndex + 1) * speed;
        });
        orbitGroups.forEach((group, groupIndex) => {
          const drift = status === 'drifting' ? Math.sin(seconds * 0.48 + groupIndex) * 0.18 : 0;
          group.rotation.y = groupIndex * 0.48 + seconds * 0.032 * speed * (groupIndex % 2 ? -1 : 1);
          group.rotation.x = 0.2 + groupIndex * 0.34 + drift;
          const geometry = orbitParticleGeometries[groupIndex];
          const position = geometry.getAttribute('position') as THREE.BufferAttribute;
          const metadata = geometry.userData as { phases: number[]; radiusX: number; radiusZ: number; index: number };
          for (let particle = 0; particle < metadata.phases.length; particle += 1) {
            const angle = metadata.phases[particle] + seconds * (0.46 + groupIndex * 0.07) * speed;
            position.setXYZ(particle, Math.cos(angle) * metadata.radiusX, Math.sin(angle * 2 + groupIndex) * 0.06, Math.sin(angle) * metadata.radiusZ);
          }
          position.needsUpdate = true;
        });
        nodeMeshes.forEach((node) => {
          const metadata = node.userData as { phase: number; radiusX: number; radiusZ: number; index: number };
          const angle = metadata.phase + seconds * (0.42 + metadata.index * 0.08) * speed;
          node.position.set(Math.cos(angle) * metadata.radiusX, 0, Math.sin(angle) * metadata.radiusZ);
        });
        renderer.render(scene, camera);
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    const visibility = () => { if (document.visibilityState === 'visible') renderer.render(scene, camera); };
    document.addEventListener('visibilitychange', visibility);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
      observer.disconnect();
      coreGeometry.dispose();
      edgeCore.geometry.dispose();
      coreMaterial.dispose();
      edgeMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      haloTexture.dispose();
      haloMaterial.dispose();
      rings.forEach((ring) => { ring.geometry.dispose(); (ring.material as THREE.Material).dispose(); });
      orbitLines.forEach((line) => { line.geometry.dispose(); (line.material as THREE.Material).dispose(); });
      orbitParticleGeometries.forEach((geometry) => geometry.dispose());
      orbitParticleMaterials.forEach((material) => material.dispose());
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      renderer.dispose();
    };
  }, [compact, reducedMotion, safeStage, shouldReduce, status, theme]);

  return (
    <section className={'core-panel ' + (compact ? 'core-panel--compact ' : '') + 'core-status-' + status} aria-label="Northstar Core">
      <div className="core-heading">
        <span className="eyebrow">NORTHSTAR CORE</span>
        {!compact && <span className="core-caption">长线成长，始于今天的选择。</span>}
      </div>
      <div className="core-stage" aria-live="polite">
        <div className={'core-render ' + (fallback ? 'is-fallback' : '')}>
          <canvas ref={canvasRef} aria-label={fallback ? '静态核心显示' : '实时程序化核心'} />
          {fallback && <img src={fallbackAsset} alt="静态核心降级" />}
        </div>
        {fallback && <span className="fallback-note">静态显示 · WebGL 或动效已关闭</span>}
      </div>
      <div className="core-readout"><span className="core-state-label">{statusLabel[status]}</span><strong>Stage {roman[safeStage - 1]} · {stageNames[safeStage - 1]}</strong><small>{statusText[status]}</small></div>
      {!compact && <StageRail stage={safeStage} />}
      <button className="secondary-button core-action" type="button" onClick={onOpenSession}>进入战略会话 <ArrowIcon /></button>
      {!compact && <p className="core-footnote">每次完成重要成果，结构再多一层；状态会波动，阶段不会倒退。</p>}
    </section>
  );
}

function ArrowIcon() {
  return <span aria-hidden="true">→</span>;
}

function StageRail({ stage }: { stage: number }) {
  return <div className="stage-rail" aria-label="Core 成长阶段">{stageNames.slice(0, 5).map((name, index) => <div className={'stage-node ' + (index + 1 <= stage ? 'is-reached' : '') + (index + 1 === stage ? ' is-current' : '')} key={name}><span>{roman[index]}</span><small>{name}</small></div>)}</div>;
}
