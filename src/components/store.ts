import { configureStore } from "@reduxjs/toolkit";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Form, Glyph, Repertoire } from "~/lib/data";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

interface FormState {
  loading: boolean;
  form: Form;
}

const initialState: FormState = {
  loading: true,
  form: {},
};

export const formSlice = createSlice({
  name: "form",
  initialState,
  reducers: {
    load: (state, action: PayloadAction<Record<string, Glyph>>) => {
      state.form = action.payload;
      state.loading = false;
    },
    update: (state, action: PayloadAction<[string, Glyph]>) => {
      const [key, value] = action.payload;
      state.form[key] = value;
    },
    remove: (state, action: PayloadAction<string>) => {
      delete state.form[action.payload];
    },
    mutate: (state, action: PayloadAction<[string, string]>) => {
      const [before, after] = action.payload;
      const replaceIf = (s: string) => (s === before ? after : s);
      // update itself
      const value = state.form[before];
      delete state.form[before];
      state.form[after] = { ...value, unicode: after.codePointAt(0)! };
      // update references
      for (const [_, value] of Object.entries(state.form)) {
        if (value.slice !== undefined) {
          value.slice.source = replaceIf(value.slice.source);
        }
        if (value.compound !== undefined) {
          value.compound.operandList = value.compound.operandList.map(
            replaceIf,
          ) as [string, string];
        }
      }
    },
  },
});

export const { load: loadForm, update, remove, mutate } = formSlice.actions;

export const formReducer = formSlice.reducer;

interface RepertoireState {
  loading: boolean;
  repertoire: Repertoire;
}

const initialRepertoireState: RepertoireState = {
  loading: true,
  repertoire: {},
};

export const repertoireSlice = createSlice({
  name: "repertoire",
  initialState: initialRepertoireState,
  reducers: {
    load: (state, action: PayloadAction<Repertoire>) => {
      state.repertoire = action.payload;
      state.loading = false;
    },
  },
});

export const repertoireReducer = repertoireSlice.reducer;

export const { load: loadRepertoire } = repertoireSlice.actions;

export const store = configureStore({
  reducer: {
    form: formReducer,
    repertoire: repertoireReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

export const selectForm = (state: RootState) => state.form.form;
export const selectFormLoading = (state: RootState) => state.form.loading;
export const selectRepertoire = (state: RootState) =>
  state.repertoire.repertoire;
export const selectRepertoireLoading = (state: RootState) =>
  state.repertoire.loading;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
