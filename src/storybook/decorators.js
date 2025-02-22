import { setStoryContextValue } from './storybookTool.js';
/**
 * A decorator that sets the usage panel for the story.
 * @returns {import('@storybook/react').StoryDecorator}
 */
export function usagePanelDecorator() {
    return (story, config) => {
        const _story = story();
        setStoryContextValue(config.id, 'usage', _story);
        return _story;
    };
}

/**
 * Bootstraps the app.
 * @param {() => void} callback
 * @returns {import('@storybook/react').StoryDecorator}
 */
export function bootstrapDecorator(callback) {
    let initialized = false;
    return story => {
        const _story = story();
        if (!initialized) {
            if (typeof callback === 'function') {
                callback();
            }
            initialized = true;
        }
        return _story;
    };
}
