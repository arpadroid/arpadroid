/* eslint-disable security/detect-non-literal-fs-filename */
/**
 * @typedef {import('./project.mjs').default} Project
 */
/* eslint-disable security/detect-non-literal-regexp */
import { mergeObjects } from '@arpadroid/tools/object';
import { execSync } from 'child_process';
import fs from 'fs';
import { globSync } from 'glob';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { log, logStyle } from '../utils/terminalLogger.mjs';

const argv = yargs(hideBin(process.argv)).argv;
const CI = Boolean(argv.ci ?? process.env.ci);
const QUERY = argv.query ?? process.env.query ?? '';
const STORYBOOK = Boolean(argv.storybook ?? process.env.storybook);
const JEST = Boolean(argv.jest ?? process.env.jest);
const BUILD = Boolean(argv.build ?? process.env.build);
const BROWSERS = argv.browsers ?? process.env.browsers ?? 'webkit chromium firefox';
const PORT = argv.port ?? process.env.port ?? 6006;

class ProjectTest {
    testResponse = {
        success: true,
        message: '',
        payloads: []
    };
    constructor(project, config = {}) {
        /** @type {Project} */
        this.project = project;
        this.setConfig(config);
        this.scripts = this.project.getScripts();
        this.pm2 = this.project.getArpadroidPath() + '/node_modules/pm2/bin/pm2';
        this.sb = this.project.getArpadroidPath() + '/node_modules/.bin/storybook';
        this.httpServer = this.project.getArpadroidPath() + '/node_modules/http-server/bin/http-server';
    }

    setConfig(config = {}) {
        this.config = mergeObjects(this.getDefaultConfig(), config);
    }

    getDefaultConfig() {
        return {
            storybook: STORYBOOK,
            jest: JEST,
            ci: CI,
            query: QUERY,
            browsers: BROWSERS,
            build: BUILD
        };
    }

    async test(_config = {}) {
        try {
            await this.runTest(_config);
        } catch (error) {
            log.error(error);
            return {
                success: false,
                message: error.message,
                payloads: []
            };
        }
    }

    async runTest(_config = {}) {
        const config = mergeObjects(this.config, _config);
        log.arpadroid();
        const subjectLog = logStyle.subject(`@arpadroid ${this.project?.name}`);
        this.stories = (config.storybook && globSync(`${this.project.path}/src/**/*.stories.js`)) || [];
        this.jestTests = (config.jest && globSync(`${this.project.path}/src/**/*.test.js`)) || [];
        console.log(logStyle.heading(`Testing: ${subjectLog}`));

        if (!this.stories?.length && !this.jestTests?.length) {
            log.info('Nothing to test');
            return true;
        }
        if (config.ci && this.scripts?.build) {
            await execSync('npm run build -- --logHeading=false', {
                shell: true,
                stdio: 'inherit',
                cwd: this.project.path
            });
        }
        await this.testNodeJS(config);

        if (config.jest && this.jestTests?.length) {
            await this.testJest(config);
        }
        if (config.storybook && this.stories?.length) {
            await this.testStorybook(config);
        }
        return this.testResponse;
    }

    async testNodeJS() {
        const file = `${this.project.path}/test/test.mjs`;
        if (!fs.existsSync(file)) {
            return true;
        }
        const script = `node ${file}`;
        log.task(this.project.name, 'Running node tests');
        return execSync(script, { shell: true, stdio: 'inherit', cwd: this.project.path });
    }

    async testJest() {
        
        const script = `node --experimental-vm-modules node_modules/jest/bin/jest.js --rootDir="${this.project.path}" --config="${this.getJestConfigLocation()}"`;
        log.task(this.project.name, 'running jest tests');
        return execSync(script, { shell: true, stdio: 'inherit', cwd: this.project.path });
    }

    getJestConfigLocation() {
        const path = this.project.path;
        if (fs.existsSync(`${path}/jest.config.mjs`)) {
            return `${path}/jest.config.mjs`;
        }
        if (fs.existsSync(`${path}/jest.config.cjs`)) {
            return `${path}/jest.config.cjs`;
        }
        if (fs.existsSync(`${path}/jest.config.js`)) {
            return `${path}/jest.config.js`;
        }
        return `${path}/node_modules/@arpadroid/arpadroid/src/jest/jest.config.mjs`;
    }

    async testStorybook(config = this.config) {
        const configPath = this.project.getStorybookConfigPath();
        const executable = `${this.project.getArpadroidPath()}/node_modules/@storybook/test-runner/dist/test-storybook`;
        const script = `${executable} -c ${configPath} --maxWorkers=9 --browsers ${config.browsers ?? 'chromium'} --url="http://127.0.0.1:${PORT}"`;

        /**
         * If there is a query then filter the stories to run only the ones that match the query.
         */
        if (QUERY) {
            const query = new RegExp(QUERY, 'i');
            this.stories = this.stories.filter(story => query.test(story));
        }
        /**
         * If CI is true then start the storybook server.
         */
        if (config.ci) {
            await this.stopStorybookCI();
            await this.startStorybookCI();
        }
        // run storybook test-runner
        log.task(this.project.name, 'Running storybook tests.');
        execSync(`node ${script} -c ${configPath}`, {
            shell: true,
            stdio: 'inherit',
            cwd: this.project.path
        });
        if (config.ci) {
            await this.stopStorybookCI();
        }
    }

    async startStorybookCI() {
        const configPath = this.project.getStorybookConfigPath();
        const cmd =
            `cd ${this.project.path} && rm -rf ${this.project.path}/storybook-static && ` +
            `${this.sb} build -c ${configPath} && ${this.pm2} start ${this.httpServer} --name 'srv-storybook' -- ./storybook-static --port ${PORT} --host 127.0.0.1 --silent`;
        return execSync(cmd, { shell: true, stdio: 'inherit', cwd: this.project.path });
    }

    async stopStorybookCI() {
        const processExists = Boolean((await execSync(`${this.pm2} pid srv-storybook`)).toString().trim());
        if (!processExists) {
            return Promise.resolve();
        }
        return execSync(`${this.pm2} stop srv-storybook && ${this.pm2} delete srv-storybook`, {
            shell: true,
            stdio: 'inherit',
            cwd: this.project.path
        });
    }
}

export default ProjectTest;
