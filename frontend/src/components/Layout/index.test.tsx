import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Layout } from "./index";

describe("Layout", () => {
  it("renders without crashing", () => {
    // Note: Provide basic props if needed, or mock stores/hooks
    // This is a basic boilerplate test
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>);
    expect(container).toBeTruthy();
  });
});
