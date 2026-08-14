export function evaluateNodeRuntime(version, platform, arch) {
  const parsedVersion = parseNodeVersion(version);
  if (!parsedVersion) {
    return {
      ok: false,
      reason: `无法解析 Node.js 版本 version="${version}"。`,
    };
  }

  if (!isSupportedNodeVersion(parsedVersion)) {
    return {
      ok: false,
      reason: `Node.js ${version} 不满足项目要求，请使用 20.19.x 或 22.12+。`,
    };
  }

  if (platform === 'win32' && !['x64', 'arm64'].includes(arch)) {
    return {
      ok: false,
      reason: `Windows ${arch} 架构缺少稳定的 Vite/Rolldown 原生绑定支持，请使用 Windows x64 或 arm64 Node.js。`,
    };
  }

  if (platform === 'darwin' && !['x64', 'arm64'].includes(arch)) {
    return {
      ok: false,
      reason: `macOS ${arch} 架构缺少稳定的 Vite/Rolldown 原生绑定支持，请使用 macOS x64 或 arm64 Node.js。`,
    };
  }

  return { ok: true };
}

export function isNativeBindingFailure(output) {
  return /Cannot find native binding|not a valid Win32 application|@rolldown[\\/]+binding|rolldown-binding|@rollup[\\/]+rollup/i.test(
    output,
  );
}

function parseNodeVersion(version) {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return undefined;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function isSupportedNodeVersion(version) {
  if (version.major === 20) {
    return version.minor > 19 || (version.minor === 19 && version.patch >= 0);
  }

  if (version.major === 22) {
    return version.minor > 12 || (version.minor === 12 && version.patch >= 0);
  }

  return version.major > 22;
}
