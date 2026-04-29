import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.150.1/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.150.1/examples/jsm/loaders/GLTFLoader.js';

// 配置
const localModel = './model.glb';
const fallbackModel = 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Box/glTF-Binary/Box.glb';

const canvas = document.getElementById('three-canvas');
const overlay = document.getElementById('loading-overlay');
const progressText = document.getElementById('progress-text');
const loadingHint = document.getElementById('loading-hint');

// Three.js 基础
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x1c2230, 1);

let width = canvas.clientWidth || window.innerWidth * 0.6;
let height = canvas.clientHeight || window.innerHeight * 0.6;

renderer.setSize(width, height, false);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
camera.position.set(0, 0.7, 2.9);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = true;
controls.enablePan = true;

// 环境光与材质氛围
scene.add(new THREE.AmbientLight(0xcff2ff, 1));
scene.add(new THREE.DirectionalLight(0xffffff, 0.85));

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new THREE.Scene()).texture; // 物理材质效果优化

let modelObj;
function centerAndScaleModel(model) {
  // 居中并缩放
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center); // 重心归零
  const maxAxis = Math.max(size.x, size.y, size.z);
  const scale = 1.15 / maxAxis;
  model.scale.set(scale, scale, scale);
}

// 加载模型
function loadModel(src, isFallback = false) {
  const loader = new GLTFLoader();

  loader.load(
    src,
    (gltf) => {
      modelObj = gltf.scene;
      centerAndScaleModel(modelObj);

      // 尝试给玻璃物理材质
      modelObj.traverse(obj => {
        if (obj.isMesh) {
          obj.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0,
            roughness: 0,
            transparent: true,
            transmission: 0.97,
            thickness: 1.6,
            ior: 1.53,
            reflectivity: 0.48,
            clearcoat: 1, clearcoatRoughness: 0.04,
            opacity: 0.96,
            envMapIntensity: 1
          });
        }
      });

      scene.add(modelObj);
      overlay.style.opacity = 0;
      progressText.textContent = '加载成功！';
      loadingHint.textContent = '';
    },
    (xhr) => {
      if (xhr.lengthComputable) {
        const percent = Math.round(xhr.loaded / xhr.total * 100);
        progressText.textContent = `加载中… ${percent}%`;
      }
    },
    (err) => {
      // 回退提示
      if (!isFallback) {
        console.warn('main 3D模型加载失败：', err);
        loadingHint.textContent = '未检测到本地3D模型，自动切换为示意模型（如需自定义请上传 model.glb 到仓库）。';
        loadModel(fallbackModel, true);
      } else {
        progressText.textContent = '加载失败';
        loadingHint.textContent = '在线备选模型也不可用，请刷新或更换网络。';
        // 直接用示意体
        const geometry = new THREE.TorusKnotGeometry(0.45, 0.13, 88, 18);
        const material = new THREE.MeshPhysicalMaterial({
          color: 0xbfdfff, roughness: 0, transmission: 0.93, transparent: true, opacity: 0.92, thickness: 1.02,
          ior: 1.45, envMapIntensity: 0.4, clearcoat: 1, clearcoatRoughness: 0.09
        });
        const mesh = new THREE.Mesh(geometry, material);
        centerAndScaleModel(mesh);
        scene.add(mesh);
        overlay.style.opacity = 0.7;
      }
    }
  );
}

loadModel(localModel);

// 动画互动，支持炫光
let pointer = { x: 0, y: 0 };
canvas.addEventListener('pointermove', e => {
  pointer.x = (e.offsetX / width) * 2 - 1;
  pointer.y = -(e.offsetY / height) * 2 + 1;
});
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // 模拟鼠标炫光（可选特效）
  if (modelObj) {
    modelObj.rotation.y += 0.0015 + pointer.x * 0.0012;
    modelObj.rotation.x += pointer.y * 0.001;
  }
  renderer.render(scene, camera);
}
animate();

// 响应窗口
window.addEventListener('resize', () => {
  width = canvas.clientWidth || window.innerWidth * 0.98;
  height = canvas.clientHeight || window.innerHeight * 0.6;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
});

// 防止页面因网络而模块加载失败——所有CDN与本地路径都“ ./xxxx ”为前缀，可国内外畅通
