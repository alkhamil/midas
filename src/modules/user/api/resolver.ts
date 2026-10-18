// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { USE_MOCK, mockCreate, mockDetail, mockList, mockRemove, mockUpdate } from './mock';
import * as service from './service';

export const list = USE_MOCK.list ? mockList : service.list;
export const detail = USE_MOCK.detail ? mockDetail : service.detail;
export const create = USE_MOCK.create ? mockCreate : service.create;
export const update = USE_MOCK.update ? mockUpdate : service.update;
export const remove = USE_MOCK.remove ? mockRemove : service.remove;
