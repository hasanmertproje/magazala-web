import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importSource(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: path,
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
}

const { publicRequestUrl, assertSameOrigin } = await importSource('../apps/web/lib/request-security.ts');
const oldUrl = process.env.APP_URL;
const oldMode = process.env.NODE_ENV;
function withSettings(url, mode, fn) {
  try {
    if (url === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = url;
    process.env.NODE_ENV = mode;
    fn();
  } finally {
    if (oldUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = oldUrl;
    if (oldMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldMode;
  }
}

test('configured public origin overrides spoofed forwarded host', () => {
  withSettings('https://magazala.example', 'production', () => {
    const request = new Request('https://internal:3000/', {
      headers: { 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'http' },
    });
    assert.equal(publicRequestUrl('/login', request).href, 'https://magazala.example/login');
    assert.doesNotThrow(() => assertSameOrigin(new Request('https://internal:3000/', {
      headers: { origin: 'https://magazala.example' },
    })));
    assert.throws(() => assertSameOrigin(new Request('https://internal:3000/', {
      headers: { origin: 'https://evil.example' },
    })), /ORIGIN_MISMATCH/);
  });
});

test('production requires configured public origin', () => {
  withSettings(undefined, 'production', () => {
    assert.throws(() => publicRequestUrl('/', new Request('https://internal/')), /APP_URL_REQUIRED/);
  });
});

test('production rejects insecure public origin except local loopback', () => {
  withSettings('http://magazala.example', 'production', () => {
    assert.throws(() => publicRequestUrl('/', new Request('http://internal/')), /PUBLIC_ORIGIN_HTTPS_REQUIRED/);
  });
  withSettings('http://localhost:3000', 'production', () => {
    assert.equal(publicRequestUrl('/login', new Request('http://localhost:3000/')).pathname, '/login');
  });
});

test('cross-site and malformed origins are rejected', () => {
  withSettings('https://magazala.example', 'production', () => {
    assert.throws(() => assertSameOrigin(new Request('https://internal/', {
      headers: { 'sec-fetch-site': 'cross-site' },
    })), /CROSS_SITE_REQUEST_REJECTED/);
    assert.throws(() => assertSameOrigin(new Request('https://internal/', {
      headers: { origin: 'not-an-origin' },
    })), /ORIGIN_INVALID/);
  });
});
