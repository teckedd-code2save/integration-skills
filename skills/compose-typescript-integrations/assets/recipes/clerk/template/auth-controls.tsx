import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function ClerkAuthControls() {
  return (
    <div aria-label="Account controls">
      <Show when="signed-out">
        <SignInButton />
        <SignUpButton />
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
