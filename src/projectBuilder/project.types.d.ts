export type CompileTypesType = {
    filePattern?: string;
    inputDir?: string;
    destination?: string;
    prependFiles?: string[];
};

export type CommandArgsType = {
    watch?: boolean;
    slim?: boolean;
    deps?: string;
    minify: string;
    storybook: Record<string, unknown>;
    'style-patterns': string;
    verbose: boolean;
    noTypes: boolean;
};


export type TestArgsType = {
    ci?: boolean;
    watch?: boolean;
    jest?: boolean;
    build?: boolean;
    browsers?: string;
    storybook?: boolean;
    port?: number;
    query?: string;
}