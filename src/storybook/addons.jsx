import React from 'react';
import { Source } from '@storybook/blocks';
import { AddonPanel } from '@storybook/components';
import { addons, types } from '@storybook/manager-api';
import { getStoryContextValue } from './storybookTool.js';

export function usagePanelAddon() {
    addons.register('usage/panel', api => {
        addons.add('usage/panel', {
            title: 'Usage',
            paramKey: 'usage',
            type: types.PANEL,
            render: props => {
                const story = api.getCurrentStoryData();
                const usage = String(getStoryContextValue(story?.id, 'usage'));
                return (
                    <AddonPanel active={Boolean(props.active)}>
                        <Source code={usage} language="html" dark format="html" />
                    </AddonPanel>
                );
            }
        });
    });
}
