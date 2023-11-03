import { configureStore } from "@reduxjs/toolkit";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Glyph } from "~/lib/data";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

interface FormState {
  loading: boolean;
  form: Record<string, Glyph>;
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

export const { load, update, remove, mutate } = formSlice.actions;

export const selectForm = (state: RootState) => state.form.form;
export const selectLoading = (state: RootState) => state.form.loading;

export const formReducer = formSlice.reducer;
// ...

export const store = configureStore({
  reducer: {
    form: formReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
