import { Form, Glyph } from "~/lib/data";
import { RootState } from "../store";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

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
      load: (state: { form: any; loading: boolean; }, action: PayloadAction<Record<string, Glyph>>) => {
        state.form = action.payload;
        state.loading = false;
      },
      update: (state: { form: { [x: string]: any; }; }, action: PayloadAction<Glyph>) => {
        state.form[String.fromCodePoint(action.payload.unicode)] = action.payload;
      },
      remove: (state: { form: { [x: string]: any; }; }, action: PayloadAction<number>) => {
        delete state.form[String.fromCodePoint(action.payload)];
      },
      mutate: (state: { form: { [s: string]: unknown; } | ArrayLike<unknown>; }, action: PayloadAction<[number, number]>) => {
        const [before, after] = action.payload.map((x: number) =>
          String.fromCodePoint(x),
        );
        const replaceIf = (s: string) => (s === before ? after : s);
        // update itself
        const value = state.form[before];
        delete state.form[before];
        state.form[after] = { ...value, unicode: after.codePointAt(0)! };
        // update references
        for (const [_, value] of Object.entries(state.form)) {
          if (value.component?.source !== undefined) {
            value.component.source = replaceIf(value.component.source);
          }
          if (value.compound !== undefined) {
            value.compound.forEach(
              (x: { operandList: string[]; }) => (x.operandList = x.operandList.map(replaceIf)),
            );
          }
        }
      },
    },
  });
  
export const { load: loadForm, update, remove, mutate } = formSlice.actions;

export const formReducer = formSlice.reducer;

export const selectForm = (state: RootState) => state.form.form;
export const selectFormLoading = (state: RootState) => state.form.loading;