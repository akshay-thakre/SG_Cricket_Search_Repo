// Legacy compatibility wrapper - real implementation is in apiService.js
import { searchAcrossPlatforms as search } from './apiService';

export const searchAcrossPlatforms = search;

export const PLATFORMS = {
  CRICCLUBS: 'CricClubs (SCA)',
  STUMPS: 'Stumps',
  LAST_MAN_STANDS: 'Last Man Stands',
  CRICHEROES: 'CricHeroes'
};