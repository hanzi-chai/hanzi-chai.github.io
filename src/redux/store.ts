import { configureStore } from "@reduxjs/toolkit";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Form, Glyph, GlyphOptionalUnicode, Repertoire } from "~/lib/data";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { formReducer } from "./slices/formSlices";
import { repertoireReducer } from "./slices/repertoireSlice";



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

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
