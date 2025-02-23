import { InputPluginOption, OutputOptions, Plugin, RollupOptions } from 'rollup';
import type Project from '../../projectBuilder/project.mjs';
import { RollupPlugin } from './rollup-builds.mjs';
import { Preview } from '@storybook/web-components';

export type BuildConfigType = {
    processBuilds?: (builds: RollupOptions[]) => void;
    deps?: string[];
    buildStyles?: boolean;
    buildJS?: boolean;
    buildTypes?: boolean;
    buildI18n?: boolean;
    buildDeps?: boolean;
    path?: string;
    basePath?: string;
    style_patterns?: string | string[];
    external?: string[];
    plugins?: Plugin[];
    slim?: boolean;
    aliases?: string[];
    parent?: string;
    minify?: boolean;
    logHeading?: boolean;
    file?: string;
    storybook?: {
        preview?: Preview;
    };
    watch?: boolean;
};

export type BuildInterface = {
    build: RollupOptions[];
    appBuild: RollupOptions;
    typesBuild: RollupOptions;
    project: Project;
    buildConfig: BuildConfigType;
    plugins: InputPluginOption;
    Plugins: Record<string, RollupPlugin>;
    output: OutputOptions | OutputOptions[] | undefined;
};
