import { Repertoire } from "~/lib/data";
import { RootState } from "../store";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

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

export const selectRepertoire = (state: RootState) =>
    state.repertoire.repertoire;
export const selectRepertoireLoading = (state: RootState) =>
    state.repertoire.loading;