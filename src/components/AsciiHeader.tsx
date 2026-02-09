import { useIsMobile } from '@/hooks/use-mobile';

export function AsciiHeader() {
  const isMobile = useIsMobile();

  const artFull = `
 ██████╗ ███████╗███╗   ██╗██╗      █████╗ ██╗   ██╗███████╗██████╗ 
██╔════╝ ██╔════╝████╗  ██║██║     ██╔══██╗╚██╗ ██╔╝██╔════╝██╔══██╗
██║  ███╗█████╗  ██╔██╗ ██║██║     ███████║ ╚████╔╝ █████╗  ██████╔╝
██║   ██║██╔══╝  ██║╚██╗██║██║     ██╔══██║  ╚██╔╝  ██╔══╝  ██╔══██╗
╚██████╔╝███████╗██║ ╚████║███████╗██║  ██║   ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
              ░▒▓ C H R O N I C L E S ▓▒░`;

  const artMobile = `
 ██████╗ ██╗     
██╔════╝ ██║     
██║  ███╗██║     
██║   ██║██║     
╚██████╔╝███████╗
 ╚═════╝ ╚══════╝
 CHRONICLES`;

  return (
    <pre className={`text-primary terminal-glow leading-tight font-mono select-none whitespace-pre overflow-hidden ${
      isMobile ? 'text-[0.5rem]' : 'text-[0.4rem] sm:text-[0.55rem] md:text-xs'
    }`}>
      {isMobile ? artMobile : artFull}
    </pre>
  );
}
