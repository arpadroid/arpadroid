export type StorybookToolConfigType = {
    storybook?: {
        preview?: Record<string, unknown>;
    };
};

export type StoryContextType = Record<string, any>;

declare global {
    interface Window {
        _storyContext?: Record<string, unknown>;
    }
}
