import { setStoryContextValue } from './storybookTool';

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
