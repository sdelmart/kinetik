import { BUILTIN_WORLDS } from '../core/worlds.js';
import { loadSettings, saveSettings } from '../state/settings.js';
import {
  loadSave,
  persistSave,
  loadCustomWorlds,
  persistCustomWorlds,
} from '../state/save.js';
import {
  loadProfiles,
  resolveActiveProfile,
  setActiveProfileId,
  profileKey,
} from '../state/profiles.js';
import { STARTING_TOKENS } from '../core/hints.js';
import { dailyWorld, DAILY_WORLD_ID } from '../core/daily.js';
import { buildContext, evaluateAchievements } from '../core/achievements.js';
import { loadUnlockedAchievements, persistUnlockedAchievements } from '../state/achievements.js';
import { read, write } from '../state/storage.js';
import { setLanguage, t } from '../i18n/index.js';
import { setMusicVolume, setSfxVolume, setMuted, unlock } from '../audio/engine.js';
import { playTrack, stopMusic } from '../audio/music.js';
import { BackgroundLayer } from '../render/background.js';

import { profilesScreen } from './screens/profiles.js';
import { menuScreen } from './screens/menu.js';
import { worldsScreen } from './screens/worlds.js';
import { levelsScreen } from './screens/levels.js';
import { gameScreen } from './screens/game.js';
import { settingsScreen } from './screens/settings.js';
import { editorScreen } from './screens/editor.js';
import { creditsScreen } from './screens/credits.js';
import { achievementsScreen } from './screens/achievements.js';
import { statisticsScreen } from './screens/statistics.js';

const SCREENS = {
  profiles: profilesScreen,
  menu: menuScreen,
  worlds: worldsScreen,
  levels: levelsScreen,
  game: gameScreen,
  settings: settingsScreen,
  editor: editorScreen,
  credits: creditsScreen,
  achievements: achievementsScreen,
  statistics: statisticsScreen,
};

/**
 * Application shell: owns the active profile, its persistent state, routing,
 * and the audio/display settings every screen reads. Screens are plain
 * factories returning `{ element, mount?, unmount? }`, so none of them reach
 * into each other.
 */
export class App {
  constructor(host) {
    this.host = host;
    this.profiles = loadProfiles();
    this.profile = resolveActiveProfile(this.profiles);
    this.current = null;
    this.route = { name: 'menu', params: {} };

    const canvas = document.getElementById('background');
    this.background = canvas ? new BackgroundLayer(canvas) : null;

    this.loadProfileState();

    // Browsers block audio until the first gesture.
    const kick = () => {
      unlock();
      this.playMusic();
    };
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
  }

  /** Everything below lives under the active profile's storage namespace. */
  key(name) {
    return this.profile ? profileKey(this.profile.id, name) : name;
  }

  loadProfileState() {
    this.settings = loadSettings(this.key('settings'));
    this.save = loadSave(this.key('save'));
    this.customWorlds = loadCustomWorlds(this.key('worlds'));
    this.hintTokens = this.readHintTokens();
    this.achievements = loadUnlockedAchievements(this.key('achievements'));

    setLanguage(this.settings.language);
    this.applyDisplaySettings();
    this.applyAudioSettings();
    this.background?.start();
  }

  readHintTokens() {
    const stored = read(this.key('hints'), null);
    return Number.isFinite(stored) ? stored : STARTING_TOKENS;
  }

  setHintTokens(value) {
    this.hintTokens = Math.max(0, Math.round(value));
    write(this.key('hints'), this.hintTokens);
  }

  switchProfile(profile) {
    this.profile = profile;
    setActiveProfileId(profile?.id ?? null);
    this.loadProfileState();
  }

  get worlds() {
    return [...BUILTIN_WORLDS, ...this.customWorlds];
  }

  worldTitle(world) {
    if (world.daily) return t('daily_challenge');
    return world.builtin ? t(`world.${world.id}`) : world.name;
  }

  /** The daily challenge is generated on the fly, so it isn't in `worlds`. */
  findWorld(id) {
    if (id === DAILY_WORLD_ID) return dailyWorld();
    return this.worlds.find((w) => w.id === id) ?? null;
  }

  /**
   * Re-evaluates every achievement against current save data. Call after any
   * event that could unlock one (a win, importing a level, etc.) — cheap and
   * idempotent, so there's no need to track which event might matter.
   */
  checkAchievements() {
    const { unlocked, newly } = evaluateAchievements(buildContext(this), this.achievements);
    if (newly.length) {
      this.achievements = unlocked;
      persistUnlockedAchievements(unlocked, this.key('achievements'));
    }
    return newly;
  }

  // --- persistence ---

  updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings, this.key('settings'));
    this.applyDisplaySettings();
    this.applyAudioSettings();
  }

  updateSave(next) {
    this.save = next;
    persistSave(next, this.key('save'));
  }

  updateCustomWorlds(worlds) {
    this.customWorlds = worlds;
    persistCustomWorlds(worlds, this.key('worlds'));
  }

  applyDisplaySettings() {
    document.body.classList.toggle('no-scanlines', !this.settings.scanlines);
    document.body.classList.toggle('no-glow', !this.settings.glow);
    this.background?.setStyle(this.settings.background);
    this.background?.setFpsCap(this.settings.fpsCap);
  }

  applyAudioSettings() {
    setMusicVolume(this.settings.musicVolume);
    setSfxVolume(this.settings.sfxVolume);
    setMuted(this.settings.muted);
  }

  toggleMute() {
    this.updateSettings({ muted: !this.settings.muted });
    return this.settings.muted;
  }

  /** 'silence' is a real choice in the track list, and simply stops playback. */
  playMusic() {
    if (this.settings.musicTrack === 'silence') stopMusic();
    else playTrack(this.settings.musicTrack);
  }

  // --- routing ---

  go(name, params = {}) {
    const factory = SCREENS[name];
    if (!factory) throw new Error(`unknown screen: ${name}`);

    this.current?.unmount?.();
    this.host.replaceChildren();

    this.route = { name, params };
    // The background picks up the colour of whichever sector is in play.
    const world = params.worldId ? this.findWorld(params.worldId) : null;
    this.background?.setAccent(world?.accent ?? '#00e5ff');

    this.current = factory(this, params);
    this.host.append(this.current.element);
    this.current.mount?.();
    this.playMusic();
  }

  /** Re-renders the current screen, e.g. after a language change. */
  refresh() {
    this.go(this.route.name, this.route.params);
  }

  start() {
    this.go(this.profile ? 'menu' : 'profiles');
  }
}
