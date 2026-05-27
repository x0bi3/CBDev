interface Props {
  onClick?: () => void;
}

export function HomeIndicator({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={onClick ? 'Close app' : 'Home'}
      className="group relative z-40 mx-auto mb-2 flex h-8 w-full items-end justify-center"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      <span
        className="h-[5px] w-[134px] rounded-full bg-white/85 transition-all duration-300 group-hover:bg-white group-active:scale-x-90"
      />
    </button>
  );
}
