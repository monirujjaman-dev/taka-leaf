import * as SecureStore from "expo-secure-store";
import type { TokenStore } from "./client";

const KEY = "takaleaf.refreshToken";

/** The refresh token, encrypted with the Android Keystore. */
export const secureTokens: TokenStore = {
  getRefreshToken: () => SecureStore.getItemAsync(KEY),
  setRefreshToken: async (token) => {
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  },
};
