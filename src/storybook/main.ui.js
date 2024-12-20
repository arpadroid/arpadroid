import path, { basename } from 'path';
import fs from 'fs';
import Project from '../projectBuilder/project.mjs';
const html = String.raw;
const cwd = process.cwd();
const sbRoot = cwd + '/node_modules/@arpadroid/arpadroid/node_modules/@storybook';
const projectName = basename(cwd);
const projectConfig = Project._getFileConfig();

/**
 * Renders the content for the HTML head.
 * @param {string} _head
 * @returns {string}
 */
function renderPreviewHead(_head) {
    const fn = projectConfig?.storybook?.previewHead;
    const head =
        (typeof fn === 'function' && fn()) ||
        html`
            <link rel="preload" href="/i18n/en.json" as="fetch" type="application/json" />
            <link rel="stylesheet" href="/material-symbols/outlined.css" />
            <link rel="stylesheet" href="/themes/default/default.bundled.final.css" />
            <link
                id="mobile-styles"
                rel="stylesheet"
                href="/themes/mobile/mobile.bundled.final.css"
                disabled
            />
            <link id="dark-styles" rel="stylesheet" href="/themes/dark/dark.bundled.final.css" disabled />
            <script type="module" src="/arpadroid-${projectName}.js"></script>
        `;

    return `${_head}${head}`;
}

/**
 * Renders the content for the HTML body.
 * @param {string} _body
 * @returns {string}
 */
function renderPreviewBody(_body) {
    const fn = projectConfig?.storybook?.previewBody;
    const body =
        (typeof fn === 'function' && fn()) ||
        html`
            ${_body}
            <script src="http://127.0.0.1:35729/livereload.js?ext=Chrome&amp;extver=2.1.0"></script>
        `;

    return `${_body}${body}`;
}

const toolsPath = path.resolve(__dirname, '../../node_modules/@arpadroid/tools/dist/');

const staticDirs = [cwd + '/dist', cwd + '/src', toolsPath];
if (fs.existsSync(cwd + '/assets')) {
    staticDirs.push(cwd + '/assets');
}
const config = {
    stories: [cwd + '/src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
    staticDirs,
    addons: [
        `${sbRoot}/addon-a11y`,
        `${sbRoot}/addon-actions`,
        `${sbRoot}/addon-backgrounds`,
        `${sbRoot}/addon-controls`,
        `${sbRoot}/addon-docs`,
        `${sbRoot}/addon-interactions`,
        `${sbRoot}/addon-links`,
        `${sbRoot}/addon-measure`,
        `${sbRoot}/addon-outline`,
        `${sbRoot}/addon-toolbars`,
        `${sbRoot}/addon-viewport`,
        `${sbRoot}/addon-webpack5-compiler-swc`
    ],
    framework: {
        name: `${sbRoot}/web-components-webpack5`,
        options: {}
    },
    docs: { autodocs: 'tag' },
    previewBody: renderPreviewBody,
    previewHead: renderPreviewHead,
    webpackFinal: async config => {
        config.watchOptions.aggregateTimeout = 1200;
        config.watchOptions.ignored = ['**/*.css'];
        config.module.rules = config.module.rules.filter(rule => {
            const isCSSRule = rule?.test?.toString().includes('css');
            return isCSSRule ? false : true;
        });
        config.resolve.alias = config.resolve.alias || {};
        config.resolve.alias['@storybook/test'] = sbRoot + '/test';
        config.resolve.alias['@storybook/addon-actions'] = sbRoot + '/addon-actions';
        return config;
    },
    env: config => ({
        ...config,
        PROJECT_CONFIG: JSON.stringify(projectConfig)
    })
};

export default config;
