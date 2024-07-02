import { existsSync } from 'fs';
const html = String.raw;
const cwd = process.cwd();
const sbRoot = cwd + '/node_modules/@arpadroid/arpadroid/node_modules/@storybook';
const projectConfigPath = cwd + '/arpadroid.config.js';
let previewHead = '';
let projectConfig = {};
if (existsSync(projectConfigPath)) {
    projectConfig = require(projectConfigPath).default;
    if (typeof projectConfig.storybookPreviewHead === 'function') {
        previewHead = projectConfig.storybookPreviewHead();
    }
}

const config = {
    stories: [cwd + '/src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
    staticDirs: [cwd + '/dist', cwd + '/src'],
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
    previewBody: body => html`
        ${body}
        <script src="http://127.0.0.1:35729/livereload.js?ext=Chrome&amp;extver=2.1.0"></script>
    `,
    previewHead: head => html`${head}${previewHead}`,
    webpackFinal: async config => {
        config.watchOptions.aggregateTimeout = 700;
        config.watchOptions.ignored = ['**/*.css'];
        config.module.rules = config.module.rules.filter(rule => {
            const isCSSRule = rule?.test?.toString().includes('css');
            return isCSSRule ? false : true;
        });
        config.resolve.alias = config.resolve.alias || {};
        config.resolve.alias['@storybook'] = sbRoot;
        config.resolve.alias['@storybook/test'] = sbRoot + '/test';
        return config;
    },
    env: config => ({
        ...config
    })
};

export default config;
