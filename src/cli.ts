#!/usr/bin/env bun

import { render } from "ink";
import React from "react";
import { App } from "./components/App.js";

// Entry point - render the TUI
render(React.createElement(App));
