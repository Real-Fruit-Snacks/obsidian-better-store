import { describe, it, expect } from "vitest";
import { rewriteReadmeUrls } from "../src/data/readme";

const REPO = "user/repo";

describe("rewriteReadmeUrls", () => {
  it("rewrites relative markdown image URLs to raw.githubusercontent", () => {
    expect(rewriteReadmeUrls("![shot](images/demo.png)", REPO)).toBe(
      "![shot](https://raw.githubusercontent.com/user/repo/HEAD/images/demo.png)"
    );
    expect(rewriteReadmeUrls("![shot](./images/demo.png)", REPO)).toBe(
      "![shot](https://raw.githubusercontent.com/user/repo/HEAD/images/demo.png)"
    );
  });

  it("rewrites relative markdown links to github blob URLs", () => {
    expect(rewriteReadmeUrls("[docs](docs/usage.md)", REPO)).toBe(
      "[docs](https://github.com/user/repo/blob/HEAD/docs/usage.md)"
    );
  });

  it("rewrites relative <img src> in inline HTML", () => {
    expect(rewriteReadmeUrls('<img src="demo.gif" width="400">', REPO)).toBe(
      '<img src="https://raw.githubusercontent.com/user/repo/HEAD/demo.gif" width="400">'
    );
  });

  it("leaves absolute URLs, anchors, and mailto untouched", () => {
    const md = "![a](https://example.com/x.png) [b](#section) [c](mailto:x@y.z) [d](//cdn.example.com/x)";
    expect(rewriteReadmeUrls(md, REPO)).toBe(md);
  });
});
