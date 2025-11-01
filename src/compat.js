import * as core from './core.js';
import * as roster from './roster.js';
import * as stage from './stage_prizes.js';
import * as fx from './fx_countdown.js';
import * as polls from './polls_public.js';
import * as surf from './surfaces.js';
import * as storexp from './storage_exports.js';
import * as admin from './admin_users.js';
Object.assign(window, {
  baseState: core.baseState, loadAll: core.loadAll, saveAll: core.saveAll,
  getAll: core.getAll, current: core.current, setCurrent: core.setCurrent, listEvents: core.listEvents,
  cloudUpsertEventMeta: core.cloudUpsertEventMeta,
  renderGuestList: roster.renderGuestList, renderGuestListPage: roster.renderGuestListPage, filterBySearch: roster.filterBySearch,
  setGuestCheckedIn: roster.setGuestCheckedIn, getGuestByCode: roster.getGuestByCode, getGuestByName: roster.getGuestByName,
  createQRForGuest: roster.createQRForGuest, drawQR: roster.drawQR, importCSV: roster.importCSV, handleImportCSV: roster.handleImportCSV,
  normalizeName: roster.normalizeName, removeGuest: roster.removeGuest,
  prizeLeft: stage.prizeLeft, setCurrentPrize: stage.setCurrentPrize, draw: stage.draw, drawBatch: stage.drawBatch, pick: stage.pick,
  pickBatch: stage.pickBatch, pickForPrize: stage.pickForPrize, confirmBatch: stage.confirmBatch, addSnapshot: stage.addSnapshot,
  reroll: stage.reroll, rerollBatch: stage.rerollBatch, rerollCurrent: stage.rerollCurrent, rerollLast: stage.rerollLast, undoReroll: stage.undoReroll,
  startCountdown: fx.startCountdown, openCountdownOverlay: fx.openCountdownOverlay, closeCountdownOverlay: fx.closeCountdownOverlay,
  renderPollEditor: polls.renderPollEditor, renderPollVote: polls.renderPollVote, renderPollResult: polls.renderPollResult, ensurePollVotes: polls.ensurePollVotes, publishPoll: polls.publishPoll,
  showPublic: surf.showPublic, closePublic: surf.closePublic, showTablet: surf.showTablet, closeTablet: surf.closeTablet,
  currentStageUrl: surf.currentStageUrl, currentTabletUrl: surf.currentTabletUrl, currentQRUrl: surf.currentQRUrl,
  exportCSV: storexp.exportCSV, exportWinnersCSV: storexp.exportWinnersCSV, download: storexp.download,
  applyRoleUI: admin.applyRoleUI, authUser: admin.authUser,
});