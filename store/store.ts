import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
const uiSlice=createSlice({name:"ui",initialState:{selectedLeague:"GB1",selectedMatchday:1,mobileNavOpen:false},reducers:{selectLeague:(s,a:PayloadAction<string>)=>{s.selectedLeague=a.payload},selectMatchday:(s,a:PayloadAction<number>)=>{s.selectedMatchday=a.payload},toggleMobileNav:s=>{s.mobileNavOpen=!s.mobileNavOpen}}});
export const {selectLeague,selectMatchday,toggleMobileNav}=uiSlice.actions;
export const makeStore=()=>configureStore({reducer:{ui:uiSlice.reducer}}); export type AppStore=ReturnType<typeof makeStore>; export type RootState=ReturnType<AppStore["getState"]>; export type AppDispatch=AppStore["dispatch"];
