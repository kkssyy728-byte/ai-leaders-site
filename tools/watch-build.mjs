#!/usr/bin/env node

// src/ 폴더를 감시하다가 파일이 바뀌면 자동으로 build-cloudflare-pages.mjs를 다시 실행합니다.
// 사용법: node tools/watch-build.mjs
// (이 창은 계속 켜둔 채로 두고, 다른 창에서 src/ 파일을 수정 + 저장하면 됩니다.)

import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildScript = resolve(projectRoot, 'tools', 'build-cloudflare-pages.mjs');
const watchTarget = resolve(projectRoot, 'src');

let building = false;
let pending = false;
let debounceTimer = null;

function runBuild(reason) {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  const startedAt = new Date().toLocaleTimeString('ko-KR');
  console.log(`\n[watch-build] ${startedAt} ${reason} → 빌드 시작`);

  const child = spawn(process.execPath, [buildScript], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    building = false;
    if (code === 0) {
      console.log('[watch-build] 빌드 완료. Live Server가 자동으로 새로고침합니다.');
    } else {
      console.log(`[watch-build] 빌드 실패 (exit code ${code}). 위 에러 메시지를 확인하세요.`);
    }
    if (pending) {
      pending = false;
      runBuild('변경 감지');
    }
  });
}

function scheduleBuild() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runBuild('변경 감지'), 250);
}

console.log(`[watch-build] ${watchTarget} 감시를 시작합니다. (Ctrl+C로 종료)`);
runBuild('초기 빌드');

try {
  watch(watchTarget, { recursive: true }, (eventType, filename) => {
    if (!filename) {
      scheduleBuild();
      return;
    }
    // 에디터가 저장 시 만드는 임시 파일(.swp, ~ 등)은 무시합니다.
    if (/~$|\.swp$|\.tmp$/i.test(filename)) return;
    scheduleBuild();
  });
} catch (error) {
  console.error('[watch-build] 폴더 감시를 시작할 수 없습니다:', error.message);
  console.error('이 방법이 안 되면 수동으로 "node tools/build-cloudflare-pages.mjs"를 다시 실행해 주세요.');
  process.exit(1);
}
