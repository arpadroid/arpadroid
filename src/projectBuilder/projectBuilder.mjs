import { execSync } from 'child_process';
import Project from './project.mjs';
import { readFileSync } from 'fs';
const cwd = process.cwd();
const pkg = JSON.parse(readFileSync(`${cwd}/package.json`));

class projectBuilder {
    buildOrder = ['tools', 'i18n', 'application', 'ui', 'lists', 'navigation', 'messages', 'form'];

    constructor() {}

    preProcessExceptions(exceptions) {
        if (typeof exceptions === 'string') {
            return exceptions.split(',');
        }
        return Array.from(exceptions);
    }

    buildPackages(config = {}) {
        const { exceptions = [], watch = false, slim = false, sequential = false, projects } = config;
        const $projects = this.instantiateProjects({ exceptions, projects });
        const originalCwd = process.cwd();
        const commands = {};
        const cmdArray = [];
        $projects.forEach(project => {
            const cmd = project.getBuildCommand({ watch, slim });
            if (cmd) {
                commands[project.name] = `cd ${project.path} && ${cmd}`;
            }
        });
        this.buildOrder.forEach(
            projectName =>
                commands[projectName] && cmdArray.push(commands[projectName]) && delete commands[projectName]
        );
        
        Object.values(commands).forEach(cmd => cmdArray.push(cmd));
        if (cmdArray.length === 0) {
            return;
        }
        const cmd = cmdArray.join(sequential ? ' && ' : ' & ') + ' && cd ' + originalCwd;
        return execSync(cmd, { stdio: 'inherit' });
    }

    instantiateProjects(config = {}) {
        const { exceptions = [], projects = this.getAllPackages() } = config;
        const except = this.preProcessExceptions(exceptions);
        return projects
            .filter(pkg => !except.includes(pkg))
            .map(packageName => new Project(packageName))
            .filter(project => project?.validate());
    }

    getAllPackages() {
        return Object.entries(pkg.peerDependencies)
            .map(([name]) => name.startsWith('@arpadroid/') && name.replace('@arpadroid/', ''))
            .filter(Boolean);
    }
}

export default projectBuilder;
