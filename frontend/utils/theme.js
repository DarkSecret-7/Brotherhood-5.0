/*
 * This file is part of The Brotherhood Project
 *
 * Copyright (C) 2026  The Brotherhood Project Developers
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * theme.js
 *
 * FOUC-prevention theme bootstrapper.
 *
 * Runs *synchronously* in <head> before the page paints, so the user
 * never sees a "white flash" when their saved theme is dark.
 *
 * Reads the user's saved setting from localStorage (`setting_dark_mode`).
 * Falls back to the OS-level `prefers-color-scheme: dark` media query
 * if nothing has been explicitly saved. Final fallback: light mode.
 *
 * Side effects:
 *   - Sets `<html data-theme="light|dark">` so the corresponding CSS
 *     variable block in common.css takes effect.
 *   - Exposes the result on `window.__theme` so later code (login sync,
 *     settings page toggle) can read it without re-querying storage.
 *
 * Note: This file intentionally avoids ES module syntax and works as
 * a plain script tag so it can be loaded in <head> before main JS.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'setting_dark_mode';
    var ATTR = 'data-theme';

    /**
     * Read the saved theme preference. Returns one of:
     *   'true'  -> user explicitly chose dark mode
     *   'false' -> user explicitly chose light mode
     *   null    -> no explicit preference
     */
    function readSavedSetting() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            // localStorage may be unavailable (private mode, blocked).
            return null;
        }
    }

    /**
     * Detect OS-level dark preference. Returns true / false.
     */
    function prefersDark() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return true;
        }
        return false;
    }

    /**
     * Resolve the effective theme from saved setting, OS preference,
     * and the explicit fallback. Always returns 'dark' or 'light'.
     */
    function resolveTheme() {
        var saved = readSavedSetting();
        if (saved === 'true') return 'dark';
        if (saved === 'false') return 'light';
        return prefersDark() ? 'dark' : 'light';
    }

    /**
     * Apply the theme to <html>. Idempotent: safe to call multiple times.
     */
    function applyTheme(theme) {
        document.documentElement.setAttribute(ATTR, theme);
        window.__theme = {
            current: theme,
            set: function (next) { applyTheme(next); persistSetting(next === 'dark'); },
            toggle: function () { applyTheme(window.__theme.current === 'dark' ? 'light' : 'dark'); persistSetting(window.__theme.current === 'dark'); }
        };
    }

    /**
     * Persist a theme choice to localStorage. Used by the public
     * `window.__theme.set/toggle` API exposed above so that any
     * future code (landing page toggle, settings page) can update
     * the saved value synchronously.
     */
    function persistSetting(isDark) {
        try {
            localStorage.setItem(STORAGE_KEY, isDark ? 'true' : 'false');
        } catch (e) {
            console.warn('Failed to persist theme setting:', e);
            // Swallow
        }
    }

    // Apply immediately so the first paint uses the correct theme.
    // Persist the theme choice to localStorage.
    var theme = resolveTheme();
    applyTheme(theme);
    persistSetting(theme === 'dark');
})();
