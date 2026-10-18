import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rewriteImports, shimSource } from '../src/codebuilder/loader.js';

test('rewriteImports points React specifiers at shims and leaves others alone', () => {
    const code = 'import{jsx as a}from"react/jsx-runtime";import*as R from "react";import{createPortal}from\'react-dom\';import x from"react-router";const l=import("react-dom/client");';
    const out = rewriteImports(code, s => `blob:${s}`);
    assert.equal(out, 'import{jsx as a}from"blob:react/jsx-runtime";import*as R from "blob:react";import{createPortal}from\'blob:react-dom\';import x from"react-router";const l=import("blob:react-dom/client");');
});

test('shimSource re-exports named exports and default', () => {
    const src = shimSource('react', { useState: 1, default: 2, 'not-valid': 3 });
    assert.match(src, /export default \(m\.default \?\? m\);/);
    assert.match(src, /export const \{ useState \} = m;/);
    assert.doesNotMatch(src, /not-valid/);
});
