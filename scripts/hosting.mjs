// dist のビルド結果を releases/ へ焼き付け、Firebase Hosting へ上げる public/ を組み立てる。
//
// Firebase Hosting のデプロイはサイト全体の置き換えなので、過去のバージョンも
// 毎回 public/ に並べ直す必要がある。そのため配信済みの成果物は releases/ に
// コミットして残す ── 「/v1.2.3/one.js は未来永劫同じ中身」を git で担保でき、
// 過去の依存関係を引っ張って再ビルドする必要も無くなる。
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const releasesDir = join(root, "releases");
const publicDir = join(root, "public");

/** 配信するファイル。map はデバッグ用に一緒に置く。 */
const ARTIFACTS = ["one.js", "one.js.map"];
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function main() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const version = pkg.version;
  if (!SEMVER.test(version)) {
    fail(`package.json の version が x.y.z ではありません: ${version}`);
  }

  snapshot(version);
  const versions = assemble();
  console.log(
    `public/ を組み立てました (${versions.length} バージョン, 最新 ${versions[0]})`,
  );
}

/** 今回のビルドを releases/v{version}/ へ焼き付ける。 */
function snapshot(version) {
  for (const name of ARTIFACTS) {
    if (!existsSync(join(distDir, name))) {
      fail(`dist/${name} がありません。先に npm run build を実行してください`);
    }
  }

  const target = join(releasesDir, `v${version}`);
  if (existsSync(target) && !process.env.IN2ONE_ALLOW_OVERWRITE) {
    // 公開済みの URL は immutable でキャッシュされる。中身を差し替えると、
    // すでに配ったページとこれから配るページで別の SDK が動くことになる。
    for (const name of ARTIFACTS) {
      const before = hash(join(target, name));
      const after = hash(join(distDir, name));
      if (before !== after) {
        fail(
          `v${version} はすでに配信済みで、今回のビルドと中身が違います。\n` +
            `  package.json の version を上げてください（上書きするなら IN2ONE_ALLOW_OVERWRITE=1）。`,
        );
      }
    }
    return;
  }

  mkdirSync(target, { recursive: true });
  for (const name of ARTIFACTS) {
    cpSync(join(distDir, name), join(target, name));
  }
  console.log(`releases/v${version}/ を更新しました`);
}

/** releases/ から public/ を作り直す。 */
function assemble() {
  rmSync(publicDir, { recursive: true, force: true });
  mkdirSync(publicDir, { recursive: true });

  const versions = listVersions();
  if (versions.length === 0) fail("releases/ にバージョンがありません");

  // 実体は不変の /v{x.y.z}/ に置き、追従用の別名はその複製にする。
  // Hosting の redirect ではなく複製にするのは、キャッシュ制御を別名ごとに
  // 変えたい（不変は 1 年、追従は 5 分）ため。
  for (const version of versions) {
    cpSync(join(releasesDir, `v${version}`), join(publicDir, `v${version}`), {
      recursive: true,
    });
  }

  const byMajor = new Map();
  for (const version of versions) {
    const major = version.split(".")[0];
    if (!byMajor.has(major)) byMajor.set(major, version);
  }
  for (const [major, version] of byMajor) {
    cpSync(join(publicDir, `v${version}`), join(publicDir, `v${major}`), {
      recursive: true,
    });
  }
  cpSync(join(publicDir, `v${versions[0]}`), join(publicDir, "latest"), {
    recursive: true,
  });

  writeFileSync(
    join(publicDir, "versions.json"),
    `${JSON.stringify(
      {
        latest: versions[0],
        majors: Object.fromEntries(byMajor),
        versions,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(publicDir, "index.html"), indexHtml(versions, byMajor));
  return versions;
}

/** releases/ のディレクトリ名を新しい順に並べる。 */
function listVersions() {
  if (!existsSync(releasesDir)) return [];
  return readdirSync(releasesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && SEMVER.test(entry.name.slice(1)))
    .map((entry) => entry.name.slice(1))
    .sort(compareVersionsDesc);
}

function compareVersionsDesc(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return right[i] - left[i];
  }
  return 0;
}

function hash(path) {
  if (!existsSync(path)) return "";
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** 配信中のバージョンが一目で分かるだけの索引。 */
function indexHtml(versions, byMajor) {
  const rows = versions
    .map(
      (version) =>
        `      <li><code>/v${version}/one.js</code>${
          byMajor.get(version.split(".")[0]) === version
            ? ` <small>(= /v${version.split(".")[0]}/one.js)</small>`
            : ""
        }</li>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>in2 One JS SDK</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 42rem; padding: 0 1rem; line-height: 1.7; }
      code { background: #f3f4f6; padding: 0.1em 0.35em; border-radius: 4px; }
      li { margin: 0.2rem 0; }
    </style>
  </head>
  <body>
    <h1>in2 One JS SDK</h1>
    <p>外部サイトへ in2 One の機能（予約フォームなど）を埋め込むための SDK です。</p>
    <pre><code>&lt;script src="/v${versions[0].split(".")[0]}/one.js" async&gt;&lt;/script&gt;</code></pre>
    <h2>配信中のバージョン</h2>
    <ul>
${rows}
    </ul>
    <p><a href="/versions.json">versions.json</a></p>
  </body>
</html>
`;
}

function fail(message) {
  console.error(`[hosting] ${message}`);
  process.exit(1);
}

main();
