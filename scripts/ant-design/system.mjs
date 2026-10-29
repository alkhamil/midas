// Foundations of the Ant Design system, in the same layers as the WDS file:
//   Primitives (Base) → Semantic (Light, Dark) → Size (small, middle, large) → Typography.
import { readFileSync } from 'node:fs';
import { addColl, addVar, ref } from './lib.mjs';

const ANTD_TOKENS = JSON.parse(readFileSync(new URL('./antd-tokens.json', import.meta.url), 'utf8'));

const P = 'Primitives', S = 'Semantic';

// Ant Design v5 preset palettes, 1 (lightest) … 10 (darkest); 6 is the base colour.
export const PALETTES = {
    blue: ['#e6f4ff', '#bae0ff', '#91caff', '#69b1ff', '#4096ff', '#1677ff', '#0958d9', '#003eb3', '#002c8c', '#001d66'],
    purple: ['#f9f0ff', '#efdbff', '#d3adf7', '#b37feb', '#9254de', '#722ed1', '#531dab', '#391085', '#22075e', '#120338'],
    cyan: ['#e6fffb', '#b5f5ec', '#87e8de', '#5cdbd3', '#36cfc9', '#13c2c2', '#08979c', '#006d75', '#00474f', '#002329'],
    green: ['#f6ffed', '#d9f7be', '#b7eb8f', '#95de64', '#73d13d', '#52c41a', '#389e0d', '#237804', '#135200', '#092b00'],
    magenta: ['#fff0f6', '#ffd6e7', '#ffadd2', '#ff85c0', '#f759ab', '#eb2f96', '#c41d7f', '#9e1068', '#780650', '#520339'],
    red: ['#fff1f0', '#ffccc7', '#ffa39e', '#ff7875', '#ff4d4f', '#f5222d', '#cf1322', '#a8071a', '#820014', '#5c0011'],
    volcano: ['#fff2e8', '#ffd8bf', '#ffbb96', '#ff9c6e', '#ff7a45', '#fa541c', '#d4380d', '#ad2f04', '#871400', '#610b00'],
    orange: ['#fff7e6', '#ffe7ba', '#ffd591', '#ffc069', '#ffa940', '#fa8c16', '#d46b08', '#ad4e00', '#873800', '#612500'],
    gold: ['#fffbe6', '#fff1b8', '#ffe58f', '#ffd666', '#ffc53d', '#faad14', '#d48806', '#ad6800', '#874d00', '#613400'],
    yellow: ['#feffe6', '#ffffb8', '#fffb8f', '#fff566', '#ffec3d', '#fadb14', '#d4b106', '#ad8b00', '#876800', '#614700'],
    lime: ['#fcffe6', '#f4ffb8', '#eaff8f', '#d3f261', '#bae637', '#a0d911', '#7cb305', '#5b8c00', '#3f6600', '#254000'],
    geekblue: ['#f0f5ff', '#d6e4ff', '#adc6ff', '#85a5ff', '#597ef7', '#2f54eb', '#1d39c4', '#10239e', '#061178', '#030852'],
};
const NEUTRAL = ['#ffffff', '#fafafa', '#f5f5f5', '#f0f0f0', '#d9d9d9', '#bfbfbf', '#8c8c8c', '#595959', '#434343', '#262626', '#1f1f1f', '#141414', '#000000'];

export function buildFoundations() {
    // ---- Primitives
    addColl(P, ['Base']);
    addVar(P, 'white', 'color', '#ffffff');
    addVar(P, 'black', 'color', '#000000');
    NEUTRAL.forEach((c, i) => addVar(P, `neutral/${i + 1}`, 'color', c));
    for (const [name, list] of Object.entries(PALETTES)) list.forEach((c, i) => addVar(P, `${name}/${i + 1}`, 'color', c));
    for (const v of [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64]) addVar(P, `spacing/${v}`, 'number', v);
    for (const v of [0, 2, 4, 6, 8, 12, 16, 999]) addVar(P, `radius/${v}`, 'number', v);
    for (const v of [0, 1, 2]) addVar(P, `stroke/${v}`, 'number', v);
    for (const v of [12, 14, 16, 18, 20, 24, 30, 38, 46]) addVar(P, `font-size/${v}`, 'number', v);
    for (const v of [400, 500, 600]) addVar(P, `font-weight/${v}`, 'number', v);
    for (const v of [12, 14, 16, 20, 24, 32, 40, 48]) addVar(P, `size/${v}`, 'number', v);
    addVar(P, 'font-family/sans', 'string', 'Inter');
    addVar(P, 'font-family/mono', 'string', 'Geist Mono');

    // ---- Semantic (light | dark). Values are antd's own tokens, computed with antd's default and dark algorithms (antd-tokens.json).
    addColl(S, ['Light', 'Dark']);
    for (const [name, v] of Object.entries(ANTD_TOKENS)) if (name !== '$source') addVar(S, name, 'color', [v.light, v.dark]);
    // elevation (effect variables: one value holds the whole shadow stack)
    const shadow = (a, b, c) => [
        { x: 0, y: 6, blur: 16, type: 'drop', color: '#000000', spread: 0, opacity: a, visible: true },
        { x: 0, y: 3, blur: 6, type: 'drop', color: '#000000', spread: -4, opacity: b, visible: true },
        { x: 0, y: 9, blur: 28, type: 'drop', color: '#000000', spread: 8, opacity: c, visible: true },
    ];
    addVar(S, 'elevation/popup', 'effect', [shadow(0.08, 0.12, 0.05), shadow(0.32, 0.48, 0.2)]);
    addVar(S, 'elevation/card', 'effect', [[{ x: 0, y: 1, blur: 2, type: 'drop', color: '#000000', spread: -2, opacity: 0.16, visible: true }, { x: 0, y: 3, blur: 6, type: 'drop', color: '#000000', spread: 0, opacity: 0.12, visible: true }, { x: 0, y: 5, blur: 12, type: 'drop', color: '#000000', spread: 4, opacity: 0.09, visible: true }], [{ x: 0, y: 1, blur: 2, type: 'drop', color: '#000000', spread: -2, opacity: 0.48, visible: true }]]);
    // ---- Typography
    addColl('Typography', ['Mode 1']);
    addVar('Typography', 'font/family/body', 'string', ref(P, 'font-family/sans'));
    addVar('Typography', 'font/family/code', 'string', ref(P, 'font-family/mono'));
    for (const [n, size, weight] of [['heading-1', 38, 600], ['heading-2', 30, 600], ['heading-3', 24, 600], ['heading-4', 20, 600], ['heading-5', 16, 600], ['body', 14, 400], ['body-sm', 12, 400], ['body-lg', 16, 400]]) {
        addVar('Typography', `${n}/font-size`, 'number', ref(P, `font-size/${size}`));
        addVar('Typography', `${n}/font-weight`, 'number', ref(P, `font-weight/${weight}`));
    }

    // ---- Size: the three Ant sizes. Component rows are filled by each component with sizeVars().
    addColl('Size', ['small', 'middle', 'large']);
    addVar('Size', 'font-size', 'number', [ref(P, 'font-size/14'), ref(P, 'font-size/14'), ref(P, 'font-size/16')]);
    addVar('Size', 'radius', 'number', [ref(P, 'radius/4'), ref(P, 'radius/6'), ref(P, 'radius/8')]);
    addVar('Size', 'gap', 'number', [ref(P, 'spacing/4'), ref(P, 'spacing/8'), ref(P, 'spacing/8')]);
}

/** Size rows of a component: sizeVars('button', { height: [24, 32, 40], 'padding-x': [7, 15, 15] }) → Size/button/height … */
export function sizeVars(comp, rows) {
    for (const [k, v] of Object.entries(rows)) addVar('Size', `${comp}/${k}`, 'number', v);
}
