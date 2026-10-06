/* ============================================================
   PLY → KSPLAT 转换脚本
   用 @mkkellogg/gaussian-splats-3d 库把 World Labs 的 .ply 转成更紧凑的 .ksplat
   ============================================================ */

const path = require('path');
const fs = require('fs');
const GaussianSplats3D = require('../assets/vendor/gaussian-splats-3d.umd.cjs');

// 参数：输入 .ply + 输出 .ksplat
const plyPath = process.argv[2] || path.join(__dirname, '../assets/worldlabs/海边场景搭建.ply');
const ksplatPath = process.argv[3] || plyPath.replace(/\.ply$/i, '.ksplat');
const compressionLevel = parseInt(process.argv[4] || '2', 10);  // 0=无损 / 1=中等 / 2=高压缩
const splatAlphaRemovalThreshold = parseInt(process.argv[5] || '5', 10);  // 过滤 alpha 阈值
const sectionSize = 0;
const blockSize = 5.0;
const bucketSize = 256;

console.log('PLY → KSPLAT 转换开始');
console.log('  输入:', plyPath);
console.log('  输出:', ksplatPath);
console.log('  文件大小:', (fs.statSync(plyPath).size / 1024 / 1024).toFixed(2), 'MB');

const t0 = Date.now();

// 1. 读取 PLY 文件
const fileData = fs.readFileSync(plyPath);
const bufferData = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);

// 2. 解析 PLY → uncompressed splat array
console.log('  [1/3] 解析 PLY ...');
const splatArray = GaussianSplats3D.PlyParser.parseToUncompressedSplatArray(bufferData, 0);
console.log('  → splatArray 类型:', splatArray.constructor.name);
console.log('  → 属性 keys:', Object.keys(splatArray).slice(0, 20).join(', '));
const splatCount = splatArray.getSplatCount ? splatArray.getSplatCount() : (splatArray.splatCount || splatArray.numSplats || (splatArray.splatPositions && splatArray.splatPositions.length / 3));
console.log('  → 共', splatCount, '个 splat');

// 3. 生成 KSPLAT buffer
console.log('  [2/3] 压缩为 KSPLAT ...');
const generator = GaussianSplats3D.SplatBufferGenerator.getStandardGenerator(
  splatAlphaRemovalThreshold,
  compressionLevel,
  sectionSize,
  undefined,  // sceneCenter
  blockSize,
  bucketSize
);
const splatBuffer = generator.generateFromUncompressedSplatArray(splatArray);

// 4. 写入文件
console.log('  [3/3] 写入文件 ...');
fs.writeFileSync(ksplatPath, Buffer.from(splatBuffer.bufferData));

const dt = ((Date.now() - t0) / 1000).toFixed(1);
const outSize = (fs.statSync(ksplatPath).size / 1024 / 1024).toFixed(2);
console.log('  ✓ 完成！耗时', dt, '秒');
console.log('  输出文件大小:', outSize, 'MB');