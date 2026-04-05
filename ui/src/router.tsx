import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

const WelcomePage = lazy(() => import("./apps/core/pages/welcome-page"));

export const Router = () => {
  return (
    <BrowserRouter>
      <Suspense>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
