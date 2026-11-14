 
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModelSelector } from "./index";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      items: [
        { id: "1", status: "completed", modelVariant: "yolov8n" },
        { id: "2", status: "failed", modelVariant: "yolov8s" },
      ],
      total: 2,
    },
  }),
}));

describe("ModelSelector", () => {
  const defaultProps = {
    selectedJobId: null,
    onSelectJob: vi.fn(),
    modelSource: "trained" as const,
    onSourceChange: vi.fn(),
    externalFile: null,
    onExternalFile: vi.fn(),
  };

  it("renders trained model option initially", () => {
    render(<ModelSelector {...defaultProps} />);
    
    const trainedRadio = screen.getByRole("button", { name: "validationSettings.trainedModel" });
    const uploadRadio = screen.getByRole("button", { name: "validationSettings.uploadModel" });
    
    expect(trainedRadio).toBeInTheDocument();
    expect(uploadRadio).toBeInTheDocument();
  });

  it("switches to upload mode", () => {
    const onSourceChange = vi.fn();
    render(<ModelSelector {...defaultProps} onSourceChange={onSourceChange} />);
    
    fireEvent.click(screen.getByRole("button", { name: "validationSettings.uploadModel" }));
    expect(onSourceChange).toHaveBeenCalledWith("upload");
  });

  it("renders upload UI when modelSource is upload", () => {
    render(<ModelSelector {...defaultProps} modelSource="upload" />);
    expect(screen.getByText("validationSettings.selectPtModel")).toBeInTheDocument();
  });
});
