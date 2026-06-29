import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "design-captures");
const DEFAULT_BASE_URL = "https://bokgi-note.vercel.app";
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, isMobile: true },
  { name: "desktop", width: 1440, height: 1000, isMobile: false },
];

loadDotEnv(".env.local");

const baseURL = trimTrailingSlash(
  process.env.DESIGN_CAPTURE_BASE_URL || DEFAULT_BASE_URL,
);
const email = process.env.DESIGN_CAPTURE_EMAIL;
const password = process.env.DESIGN_CAPTURE_PASSWORD;
const captureOnly = new Set(
  (process.env.DESIGN_CAPTURE_ONLY || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

if (!email || !password) {
  console.error(
    [
      "DESIGN_CAPTURE_EMAIL, DESIGN_CAPTURE_PASSWORD 값이 필요합니다.",
      "예:",
      'DESIGN_CAPTURE_EMAIL="bokgi@test.com" DESIGN_CAPTURE_PASSWORD="bokgitest123!" npm run design:capture',
    ].join("\n"),
  );
  process.exit(1);
}

const runId = new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "");
const outputDir = process.env.DESIGN_CAPTURE_OUTPUT_DIR
  ? path.resolve(ROOT, process.env.DESIGN_CAPTURE_OUTPUT_DIR)
  : path.join(OUTPUT_ROOT, runId);
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of VIEWPORTS) {
    await captureViewport(browser, viewport);
  }

  console.log("");
  console.log(`캡처 완료: ${relative(outputDir)}`);
  console.log("이 폴더의 PNG 파일들을 디자인 검토용으로 확인하면 됩니다.");
} finally {
  await browser.close();
}

async function captureViewport(browserInstance, viewport) {
  const context = await browserInstance.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    deviceScaleFactor: viewport.isMobile ? 2 : 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);

  page.on("dialog", async (dialog) => {
    console.log(`[${viewport.name}] dialog: ${dialog.message()}`);
    await dialog.accept();
  });

  try {
    await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
    await shot(page, viewport.name, "01-login");

    await login(page);
    await shot(page, viewport.name, "02-dashboard");

    await openPrimaryNote(page);
    await shot(page, viewport.name, "03-note-editor");

    await page.goto(`${baseURL}/dashboard`, { waitUntil: "networkidle" });
    await openWeeklyReview(page);
    await shot(page, viewport.name, "04-review-editor");

    await page.goto(`${baseURL}/folders`, { waitUntil: "networkidle" });
    await shot(page, viewport.name, "05-folders");

    await openFirstFolder(page);
    await shot(page, viewport.name, "06-folder-detail");

    await page.goto(`${baseURL}/settings`, { waitUntil: "networkidle" });
    await shot(page, viewport.name, "07-settings");

    await page.goto(`${baseURL}/trash`, { waitUntil: "networkidle" });
    await shot(page, viewport.name, "08-trash");
  } finally {
    await context.close();
  }
}

async function login(page) {
  await page.getByPlaceholder("이메일").fill(email);
  await page.getByPlaceholder("비밀번호").fill(password);
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  await page.getByText("오늘 기록").waitFor({ timeout: 20_000 });
}

async function openPrimaryNote(page) {
  const primaryButton = page.getByRole("button", {
    name: /투자 일기 (작성하기|이어쓰기)/,
  });
  await primaryButton.click();
  await page.waitForURL(/\/notes\//, { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  await page.locator("input").first().waitFor({ state: "visible", timeout: 20_000 });
  await page
    .getByRole("button", { name: "휴지통" })
    .waitFor({ state: "visible", timeout: 20_000 });
}

async function openWeeklyReview(page) {
  const reviewButton = page.getByRole("button", { name: /이번 주 복기 시작/ });
  await reviewButton.click();

  try {
    await page.waitForURL(/\/reviews\//, { timeout: 20_000 });
    await page.waitForLoadState("networkidle");
    await page.getByText("복기 입력").waitFor({ timeout: 20_000 });
    await page.getByText("불러온 기존 메모").waitFor({ timeout: 20_000 });
  } catch {
    console.warn(
      "이번 주 복기 화면으로 이동하지 못했습니다. 현재 화면을 대신 캡처합니다.",
    );
  }
}

async function openFirstFolder(page) {
  const preferredFolder = page.getByRole("link", { name: /투자 일기/ }).first();
  if ((await preferredFolder.count()) > 0) {
    await preferredFolder.click();
  } else {
    await page.locator('a[href^="/folders/"]').first().click();
  }
  await page.waitForURL(/\/folders\/[^/]+/, { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("제목 또는 본문 검색").waitFor({ timeout: 20_000 });
  await page.getByRole("button", { name: "새 메모" }).waitFor({ timeout: 20_000 });
}

async function shot(page, viewportName, name) {
  if (captureOnly.size > 0 && !captureOnly.has(name.slice(0, 2)) && !captureOnly.has(name)) {
    return;
  }
  await page.screenshot({
    path: path.join(outputDir, `${viewportName}-${name}.png`),
    fullPage: true,
  });
  console.log(`[${viewportName}] ${name}`);
}

function loadDotEnv(fileName) {
  const envPath = path.join(ROOT, fileName);
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function relative(targetPath) {
  return path.relative(ROOT, targetPath);
}
