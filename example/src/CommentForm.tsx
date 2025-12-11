import React, { useState } from "react";
import { Button } from "./components/ui/button";

interface CommentFormProps {
  onSubmit: (input: string) => void;
  placeHolder?: string;
}

const CommentForm = ({ onSubmit, placeHolder }: CommentFormProps) => {
  const [input, setInput] = useState<string>("");

  return (
    <form
      className="flex flex-col gap-2 p-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(input);
      }}
    >
      <textarea
        placeholder={placeHolder}
        autoFocus
        className="min-h-[80px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onChange={(event) => {
          setInput(event.target.value);
        }}
      />
      <Button type="submit" size="sm" className="w-full">
        Save
      </Button>
    </form>
  );
};

export default CommentForm;
