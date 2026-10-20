import { USE_MOCK, mockLogin, mockLogout } from './mock';
import * as service from './service';

export const login = USE_MOCK.login ? mockLogin : service.login;
export const logout = USE_MOCK.logout ? mockLogout : service.logout;
