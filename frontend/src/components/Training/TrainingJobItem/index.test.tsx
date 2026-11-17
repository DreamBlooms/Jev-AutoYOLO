/* eslint-disable @typescript-eslint/no-explicit-any */
import { MemoryRouter } from "react-router-dom";

import { render } from "@/utils/test-utils";
import {describe, it, expect} from "vitest";
import { TrainingJobItem } from "./index";

describe("TrainingJobItem", () => {
  it("renders without crashing", () => {
    const { container } = render(<MemoryRouter><TrainingJobItem {...({} as any)} job={{ id: "1", name: "test", status: "completed", createdAt: "", type: "yolo", modelVariant: "yolov8n", dataSummary: { imagesCount: 0, categoriesCount: 0, boxesCount: 0, avgBoxesPerImage: 0, categoryDistribution: {} } }} /></MemoryRouter>);
    expect(container).toBeTruthy();
  });
});
