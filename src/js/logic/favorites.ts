import { categories } from '../config/tools.js';
import { showAlert } from '../ui.js';

const STORAGE_KEY = 'bentopdf-favorites';
const MAX_FAVORITES = 15;

type Tool = (typeof categories)[number]['tools'][number];

const toolsById = new Map<string, Tool>();
categories.forEach(category => {
    category.tools.forEach(tool => {
        if (!toolsById.has(tool.id)) toolsById.set(tool.id, tool);
    });
});

let favorites: string[] = [];

const saveFavorites = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
        // Favorites remain available for the current page when storage is unavailable.
    }
};

export const loadFavorites = () => {
    let stored: string | null;
    try {
        stored = localStorage.getItem(STORAGE_KEY);
    } catch {
        favorites = [];
        return [...favorites];
    }

    if (stored === null) {
        favorites = [];
        return [...favorites];
    }

    try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || !parsed.every(id => typeof id === 'string')) {
            throw new Error('Invalid Favorites data');
        }

        const uniqueIds = [...new Set<string>(parsed)];
        favorites = uniqueIds
            .filter(id => toolsById.has(id))
            .slice(0, MAX_FAVORITES);

        if (JSON.stringify(favorites) !== JSON.stringify(parsed)) saveFavorites();
    } catch {
        favorites = [];
        saveFavorites();
    }

    return [...favorites];
};

export const isFavorite = (toolId: string) => favorites.includes(toolId);

const syncFavoriteButtons = (toolGrid: HTMLElement) => {
    toolGrid.querySelectorAll<HTMLButtonElement>('.favorite-toggle').forEach(button => {
        const toolId = button.dataset.favoriteToolId!;
        const favorited = isFavorite(toolId);
        const tool = toolsById.get(toolId);
        button.classList.toggle('favorited', favorited);
        const label = favorited
            ? `Remove ${tool?.name ?? 'tool'} from Favorites`
            : `Add ${tool?.name ?? 'tool'} to Favorites`;
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-pressed', favorited.toString());
    });
};

export const renderFavorites = () => {
    const toolGrid = document.getElementById('tool-grid');
    if (!toolGrid) return;

    toolGrid.querySelector('.favorites-group')?.remove();

    if (favorites.length > 0) {
        const categoryGroup = document.createElement('div');
        categoryGroup.className = 'category-group favorites-group col-span-full';

        const title = document.createElement('h2');
        title.className = 'text-xl font-bold text-indigo-400 mb-4 mt-8 first:mt-0';
        title.textContent = 'Favorites';

        const toolsContainer = document.createElement('div');
        toolsContainer.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6';
        favorites.forEach(toolId => {
            const sourceCard = toolGrid.querySelector<HTMLElement>(`.tool-card[data-tool-id="${toolId}"]`);
            if (sourceCard) toolsContainer.appendChild(sourceCard.cloneNode(true));
        });

        categoryGroup.append(title, toolsContainer);
        toolGrid.prepend(categoryGroup);
    }

    syncFavoriteButtons(toolGrid);
};

export const toggleFavorite = (toolId: string) => {
    if (!toolsById.has(toolId)) return false;

    const index = favorites.indexOf(toolId);
    if (index >= 0) {
        favorites.splice(index, 1);
    } else {
        if (favorites.length >= MAX_FAVORITES) {
            showAlert('Favorites limit reached', 'You can save up to 15 Favorites. Remove one first.');
            return false;
        }
        favorites.push(toolId);
    }

    saveFavorites();
    return true;
};
