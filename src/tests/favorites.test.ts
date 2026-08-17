import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { categories } from '@/js/config/tools';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const styles = readFileSync(resolve('src/css/styles.css'), 'utf8');

const { showAlertMock } = vi.hoisted(() => ({ showAlertMock: vi.fn() }));

vi.mock('@/js/ui.js', () => ({ showAlert: showAlertMock }));
vi.mock('lucide', () => ({ createIcons: vi.fn(), icons: {} }));

import {
    isFavorite,
    loadFavorites,
    renderFavorites,
    toggleFavorite,
} from '@/js/logic/favorites';

const allTools = categories.flatMap(category => category.tools);
const uniqueToolsById = new Map(allTools.map(tool => [tool.id, tool]));
const uniqueTools = Array.from(uniqueToolsById.values());

const createToolCard = (tool: (typeof uniqueTools)[number]) => {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.dataset.toolId = tool.id;
    card.innerHTML = `
        <button class="favorite-toggle" data-favorite-tool-id="${tool.id}" aria-pressed="false"></button>
        <h3>${tool.name}</h3>
        <p>${tool.subtitle}</p>
    `;
    return card;
};

const setupGrid = (searchValue = '') => {
    document.body.innerHTML = `
        <input id="search-bar" value="${searchValue}">
        <div id="tool-grid"></div>
    `;
    return document.getElementById('tool-grid')!;
};

describe('Favorites', () => {
    beforeEach(() => {
        localStorage.clear();
        showAlertMock.mockClear();
        loadFavorites();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('loads valid Favorites and preserves their order when saving', () => {
        localStorage.setItem('bentopdf-favorites', JSON.stringify(['split', 'merge']));

        expect(loadFavorites()).toEqual(['split', 'merge']);
        expect(isFavorite('split')).toBe(true);

        toggleFavorite('compress');
        expect(JSON.parse(localStorage.getItem('bentopdf-favorites')!)).toEqual([
            'split',
            'merge',
            'compress',
        ]);
    });

    it.each(['not JSON', '{}', '["merge", 1]'])('resets corrupt data: %s', value => {
        localStorage.setItem('bentopdf-favorites', value);

        expect(loadFavorites()).toEqual([]);
        expect(localStorage.getItem('bentopdf-favorites')).toBe('[]');
    });

    it('prunes unknown and duplicate tool IDs from storage', () => {
        localStorage.setItem('bentopdf-favorites', JSON.stringify(['merge', 'missing', 'merge', 'split']));

        expect(loadFavorites()).toEqual(['merge', 'split']);
        expect(JSON.parse(localStorage.getItem('bentopdf-favorites')!)).toEqual(['merge', 'split']);
    });

    it('continues with in-memory Favorites when storage writes fail', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Storage unavailable');
        });

        expect(toggleFavorite('merge')).toBe(true);
        expect(isFavorite('merge')).toBe(true);
    });

    it('resets in-memory Favorites when storage reads fail', () => {
        toggleFavorite('merge');
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Storage unavailable');
        });

        expect(loadFavorites()).toEqual([]);
        expect(isFavorite('merge')).toBe(false);
    });

    it('toggles Favorites on and off', () => {
        expect(toggleFavorite('merge')).toBe(true);
        expect(isFavorite('merge')).toBe(true);

        expect(toggleFavorite('merge')).toBe(true);
        expect(isFavorite('merge')).toBe(false);
        expect(localStorage.getItem('bentopdf-favorites')).toBe('[]');
    });

    it('enforces the 15-Favorite limit without changing storage', () => {
        const firstFifteen = uniqueTools.slice(0, 15).map(tool => tool.id);
        localStorage.setItem('bentopdf-favorites', JSON.stringify(firstFifteen));
        loadFavorites();

        expect(toggleFavorite(uniqueTools[15].id)).toBe(false);
        expect(JSON.parse(localStorage.getItem('bentopdf-favorites')!)).toEqual(firstFifteen);
        expect(showAlertMock).toHaveBeenCalledWith(
            'Favorites limit reached',
            'You can save up to 15 Favorites. Remove one first.'
        );
    });

    it('truncates stored Favorites beyond the 15-Favorite limit on load', () => {
        const firstSixteen = uniqueTools.slice(0, 16).map(tool => tool.id);
        localStorage.setItem('bentopdf-favorites', JSON.stringify(firstSixteen));

        expect(loadFavorites()).toEqual(firstSixteen.slice(0, 15));
        expect(JSON.parse(localStorage.getItem('bentopdf-favorites')!)).toEqual(firstSixteen.slice(0, 15));
    });

    it('renders the Favorites section in order', () => {
        const toolGrid = setupGrid('merge');
        const split = uniqueTools.find(tool => tool.id === 'split')!;
        const merge = uniqueTools.find(tool => tool.id === 'merge')!;
        toolGrid.append(createToolCard(split), createToolCard(merge));
        localStorage.setItem('bentopdf-favorites', JSON.stringify(['split', 'merge']));
        loadFavorites();

        renderFavorites();

        const group = toolGrid.querySelector('.favorites-group')!;
        expect(group.querySelector('h2')?.textContent).toBe('Favorites');
        expect(Array.from(group.querySelectorAll<HTMLElement>('.tool-card')).map(card => card.dataset.toolId))
            .toEqual(['split', 'merge']);
    });

    it('syncs star state on every matching card and removes an empty section', () => {
        const toolGrid = setupGrid();
        const merge = uniqueTools.find(tool => tool.id === 'merge')!;
        toolGrid.append(createToolCard(merge), createToolCard(merge));

        toggleFavorite('merge');
        renderFavorites();
        expect(toolGrid.querySelector('.favorites-group')).not.toBeNull();
        expect(toolGrid.querySelectorAll('.favorite-toggle.favorited')).toHaveLength(3);

        toggleFavorite('merge');
        renderFavorites();
        expect(toolGrid.querySelector('.favorites-group')).toBeNull();
        expect(toolGrid.querySelectorAll('.favorite-toggle.favorited')).toHaveLength(0);
    });

    it('clones the existing Tool Card into Favorites', () => {
        const toolGrid = setupGrid();
        const merge = uniqueTools.find(tool => tool.id === 'merge')!;
        toolGrid.appendChild(createToolCard(merge));

        toggleFavorite('merge');
        renderFavorites();

        const cards = toolGrid.querySelectorAll<HTMLElement>('[data-tool-id="merge"]');
        expect(cards).toHaveLength(2);
        expect(cards[0]).not.toBe(cards[1]);
        expect(cards[0].querySelector('h3')?.textContent).toBe('Merge PDF');
    });

    it('reveals indigo stars on hover, keyboard focus, and touch devices', () => {
        const hiddenRule = styles.match(/\.favorite-toggle\s*\{([^}]*)\}/)?.[1];
        const visibleRule = styles.match(
            /\.tool-card:hover \.favorite-toggle,\s*\.favorite-toggle:focus-visible\s*\{([^}]*)\}/
        )?.[1];

        expect(hiddenRule).toMatch(/color:\s*#818cf8/);
        expect(hiddenRule).toMatch(/opacity:\s*0/);
        expect(hiddenRule).toMatch(/width:\s*2.75rem/);
        expect(hiddenRule).toMatch(/height:\s*2.75rem/);
        expect(visibleRule).toMatch(/opacity:\s*1/);
        expect(styles).toMatch(/@media \(hover: none\), \(pointer: coarse\)\s*{[^}]*\.favorite-toggle\s*{[^}]*opacity:\s*1/);
        expect(styles).not.toMatch(/\.favorite-toggle\.favorited\s*\{[^}]*opacity:\s*1/);
        expect(styles).toMatch(/\.favorite-toggle\.favorited svg\s*\{[^}]*fill:\s*currentColor/);
    });
});