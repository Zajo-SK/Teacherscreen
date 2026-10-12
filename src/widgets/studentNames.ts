import type { ClassList } from '@/types';
import { useRuntime } from './runtime';

interface HasNames {
  names: string[];
  classId: string | null;
}

/**
 * Zdroj mien žiakov pre widget: ak je vybraná trieda, mená sa berú z nej (a úpravy sa ukladajú do triedy),
 * inak z vlastného zoznamu widgetu. Do cloudu sa mená z widgetov nikdy neposielajú, trieda len s výslovným súhlasom.
 */
export function useStudentNames(config: HasNames, update: (p: Partial<HasNames> & Record<string, unknown>) => void, resetPatch: Record<string, unknown> = {}) {
  const rt = useRuntime();
  const cls: ClassList | undefined = config.classId ? rt.classes.find((c) => c.id === config.classId) : undefined;
  const names = cls ? cls.names : config.names;
  return {
    names,
    cls,
    classes: rt.classes,
    setNames(n: string[]) {
      if (cls) rt.saveClass({ id: cls.id, name: cls.name, names: n });
      else update({ names: n, ...resetPatch });
    },
    pickClass(id: string | null) {
      const c = id ? rt.classes.find((x) => x.id === id) : undefined;
      update({ classId: c ? c.id : null, names: c ? c.names : config.names, ...resetPatch });
    },
    saveAsClass(name: string) {
      const id = rt.saveClass({ name, names: config.names });
      update({ classId: id, ...resetPatch });
    },
  };
}
