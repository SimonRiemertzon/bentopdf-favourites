import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setupToolInterfaceMock } = vi.hoisted(() => ({
    setupToolInterfaceMock: vi.fn(),
}));

vi.mock('@/js/ui.js', () => ({
    dom: {
        get toolGrid() {
            return document.getElementById('tool-grid');
        },
        get backToGridBtn() {
            return document.getElementById('back-to-grid');
        },
        get alertOkBtn() {
            return document.getElementById('alert-ok');
        },
    },
    hideAlert: vi.fn(),
    showAlert: vi.fn(),
    switchView: vi.fn(),
}));

vi.mock('@/js/handlers/toolSelectionHandler.js', () => ({
    setupToolInterface: setupToolInterfaceMock,
}));

vi.mock('lucide', () => ({
    createIcons: vi.fn(),
    icons: {},
}));

vi.mock('pdfjs-dist', () => ({
    GlobalWorkerOptions: { workerSrc: '' },
}));

describe('Favorites integration', () => {
    beforeEach(() => {
        localStorage.clear();
        setupToolInterfaceMock.mockClear();
        document.body.innerHTML = `
            <input id="search-bar">
            <div id="tool-grid"></div>
            <button id="back-to-grid"></button>
            <button id="alert-ok"></button>
        `;
    });

    it('toggles Favorites without opening a Tool and keeps search authoritative', async () => {
        await import('@/js/main');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const originalToggle = document.querySelector<HTMLButtonElement>('.favorite-toggle')!;
        const toolId = originalToggle.dataset.favoriteToolId;
        originalToggle.click();

        expect(setupToolInterfaceMock).not.toHaveBeenCalled();
        expect(originalToggle.getAttribute('aria-pressed')).toBe('true');

        const favoritesGroup = document.querySelector<HTMLElement>('.favorites-group')!;
        const favoriteOpenButton = favoritesGroup.querySelector<HTMLButtonElement>('.tool-open')!;
        expect(favoriteOpenButton.tagName).toBe('BUTTON');

        const searchBar = document.getElementById('search-bar') as HTMLInputElement;
        searchBar.value = 'merge';
        searchBar.dispatchEvent(new Event('input'));
        expect(favoritesGroup.classList.contains('hidden')).toBe(true);

        searchBar.value = '';
        searchBar.dispatchEvent(new Event('input'));
        expect(favoritesGroup.classList.contains('hidden')).toBe(false);

        favoriteOpenButton.click();
        expect(setupToolInterfaceMock).toHaveBeenCalledWith(toolId);
    });
});
