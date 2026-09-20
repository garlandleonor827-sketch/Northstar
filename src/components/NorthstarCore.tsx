import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Theme } from '../lib/domain';

interface Props {
  theme: Theme;
  stage: number;
  status: 'focused' | 'drifting' | 'overloaded' | 'recovering' | 'dormant' | 'unknown';
  reducedMotion: boolean;
}

const statusText: Record<Props['status'], string> = {
  focused: '状态稳定 · 当前计划已确认',
  drifting: '轨道偏移 · 依据待复核',
  overloaded: '容量收束 · 建议减少动作',
  recovering: '恢复模式 · 只保留必要事项',
  dormant: '低活动 · 形态保持',
  unknown: '数据不足 · 保持中性'
};

export function NorthstarCore({ theme, stage, status, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const motionPreference = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  const shouldReduce = reducedMotion || motionPreference;

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
    camera.position.set(0, 0.1, 5.1);
    const root = new THREE.Group();
    scene.add(root);

    const lightColor = theme === 'dark' ? 0x9bdcff : 0x125882;
    scene.add(new THREE.AmbientLight(lightColor, theme === 'dark' ? 1.1 : 0.8));
    const key = new THREE.PointLight(theme === 'dark' ? 0x84cfff : 0x1d5c8e, theme === 'dark' ? 3.5 : 2.5, 8);
    key.position.set(1.1, 1.1, 2.2);
    scene.add(key);
    const fill = new THREE.PointLight(theme === 'dark' ? 0x315b96 : 0x9ab9d2, 1.2, 8);
    fill.position.set(-2, -1, 1.4);
    scene.add(fill);

    const complexity = Math.min(3, Math.max(1, stage - 1));
    const geometry = new THREE.IcosahedronGeometry(0.78 + complexity * 0.03, complexity + 1);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: theme === 'dark' ? 0x9fdcff : 0x163f62,
      emissive: theme === 'dark' ? 0x153c69 : 0x163c5a,
      emissiveIntensity: theme === 'dark' ? 1.4 : 0.72,
      metalness: 0.72,
      roughness: 0.18,
      transparent: true,
      opacity: 0.88,
      clearcoat: 0.8,
      clearcoatRoughness: 0.22
    });
    const core = new THREE.Mesh(geometry, coreMaterial);
    root.add(core);

    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 32, 32),
      new THREE.MeshBasicMaterial({ color: theme === 'dark' ? 0xdaf4ff : 0x2a76a5, transparent: true, opacity: 0.9 })
    );
    root.add(inner);

    const rings: THREE.Mesh[] = [];
    const ringCount = Math.min(4, 2 + complexity);
    for (let index = 0; index < ringCount; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.12 + index * 0.09, index === 0 ? 0.012 : 0.008, 8, 128),
        new THREE.MeshBasicMaterial({ color: theme === 'dark' ? (index % 2 ? 0x81cfff : 0xd6eaff) : (index % 2 ? 0x2b6998 : 0x688ba7), transparent: true, opacity: index === 0 ? 0.75 : 0.48 })
      );
      ring.rotation.set(index * 0.65, index * 0.42, index * 0.27);
      root.add(ring);
      rings.push(ring);
    }

    const particleCount = 100 + complexity * 35;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const radius = 1.45 + Math.random() * 0.55;
      const angle = Math.random() * Math.PI * 2;
      particlePositions[index * 3] = Math.cos(angle) * radius;
      particlePositions[index * 3 + 1] = (Math.random() - 0.5) * 1.5;
      particlePositions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: theme === 'dark' ? 0x9edcff : 0x3479a5, size: 0.022, transparent: true, opacity: 0.58 }));
    root.add(particles);

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
        const slowFactor = status === 'recovering' ? 0.35 : status === 'dormant' ? 0.12 : status === 'overloaded' ? 0.55 : 1;
        core.rotation.x = seconds * 0.08 * slowFactor;
        core.rotation.y = seconds * 0.13 * slowFactor;
        inner.scale.setScalar(1 + Math.sin(seconds * 0.8) * 0.06);
        rings.forEach((ring, index) => {
          ring.rotation.x += 0.0007 * (index + 1) * slowFactor;
          ring.rotation.z -= 0.0005 * (index + 1) * slowFactor;
        });
        particles.rotation.y = seconds * 0.025 * slowFactor;
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const visibility = () => { if (document.visibilityState === 'visible') renderer.render(scene, camera); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
      observer.disconnect();
      geometry.dispose();
      coreMaterial.dispose();
      inner.geometry.dispose();
      (inner.material as THREE.Material).dispose();
      rings.forEach((ring) => { ring.geometry.dispose(); (ring.material as THREE.Material).dispose(); });
      particleGeometry.dispose();
      (particles.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, [shouldReduce, status, stage, theme]);

  return (
    <section className="core-panel" aria-label="Northstar Core">
      <div className="core-heading">
        <span className="eyebrow">NORTHSTAR CORE</span>
        <span className="core-caption">长线成长，始于今天的选择。</span>
      </div>
      <div className="core-stage" aria-live="polite">
        <div className={`core-render ${fallback ? 'is-fallback' : ''}`}>
          <canvas ref={canvasRef} aria-label={fallback ? '静态核心显示' : '实时程序化核心'} />
          {fallback && <img src={theme === 'dark' ? '/assets/core/core-fallback-dark.png' : '/assets/core/core-fallback-light.png'} alt="静态核心降级" />}
        </div>
        {fallback && <span className="fallback-note">静态显示 · WebGL 或动效已关闭</span>}
      </div>
      <div className="core-status">
        <strong>{status.toUpperCase()} · STAGE {Math.max(1, Math.min(7, stage))}</strong>
        <span>{statusText[status]}</span>
      </div>
      <button className="secondary-button core-action" type="button">进入战略会话 <span aria-hidden="true">→</span></button>
      <p className="core-footnote">每次完成重要成果，结构再多一层。</p>
    </section>
  );
}
