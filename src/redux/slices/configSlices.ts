import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Classifier, FormConfig, PronunciationConfig, Source, Condition } from '~/lib/config';
import { Form, Repertoire } from '~/lib/data';

interface Config {
  version: string;
  source?: string;
  info: {
    name: string;
    author: string;
    version: string;
    description: string;
  };
  data: {
    form: Form;
    repertoire: Repertoire;
    classifier: Classifier;
  };
  form: FormConfig;
  pronunciation: PronunciationConfig;
  encoder: {
    sources: Record<string, Source>;
    conditions: Record<string, Condition>;
  };
}

//TODO:替换默认值
const initialState: Config = {
  version: '', 
  source: undefined, 
  info: {
    name: '',
    author: '',
    version: '',
    description: '',
  },
  data: {
    form: {}, // 替换为 Form 的默认值
    repertoire: {}, // 替换为 Repertoire 的默认值
    classifier: {}, // 替换为 Classifier 的默认值
  },
  form: {}, // 替换为 FormConfig 的默认值
  pronunciation: {}, // 替换为 PronunciationConfig 的默认值
  encoder: {
    sources: {},
    conditions: {},
  },
};


const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    loadConfig(state, action: PayloadAction<Config>) {
      return { ...state, ...action.payload };
    },
    updateInfo(state, action: PayloadAction<InfoType>) {
      state.info = action.payload;
    },
    updateData(state, action: PayloadAction<DataActionPayload>) {
      const { actionType, subtype, key, value } = action.payload;

      switch (actionType) {
        case "add":
          state.data[subtype][key] = value;
          break;
        case "remove":
          delete state.data[subtype][key];
          break;
      }
    },

    updateElement(state, action: PayloadAction<ElementActionPayload>) {
      const { subtype, actionType, key, value } = action.payload;
      let element = state.form; // 或者根据 subtype 确定元素

      switch (subtype) {
        case "generic-alphabet":
          element.alphabet = value;
          break;
        case "generic-maxcodelen":
          element.maxcodelen = value;
          break;
        case "generic-mapping":
          switch (actionType) {
            case "add":
              element.mapping[key] = value;
              break;
            case "remove":
              delete element.mapping[key];
              break;
          }
          break;
      }
    },
    updateEncoder(state, action: PayloadAction<EncoderType>) {
      state.encoder = action.payload;
    },
    // 其他需要的 reducers
  },
});

// 导出 action creators
export const { loadConfig, updateInfo, updateData, updateElement, updateEncoder } = configSlice.actions;

// 导出 reducer
export default configSlice.reducer;
