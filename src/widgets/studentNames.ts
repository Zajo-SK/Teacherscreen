import type { ClassList, GroupRules } from '@/types';
import { emptyRules } from '@/lib/groups';
import { activeNames, normalizeAbsent } from '@/lib/attendance';
import { useRuntime } from './runtime';

interface HasNames {
  names: string[];
  classId: string | null;
  rules?: GroupRules;
  /** Jednorazovo neprítomní žiaci (preskočia sa). */
  absent?: string[];
}

/**
 * Zdroj mien žiakov (a pravidiel skupín) pre widget: ak je vybraná trieda, berie sa z nej (a úpravy sa ukladajú do triedy),
 * inak z vlastného zoznamu widgetu. Do cloudu sa mená z widgetov nikdy neposielajú, trieda len s výslovným súhlasom.
 */
export function useStudentNames(config: HasNames, update: (p: Record<string, unknown>) => void, resetPatch: Record<string, unknown> = {}) {
  const rt = useRuntime();
  const cls: ClassList | undefined = config.classId ? rt.classes.find((c) => c.id === config.classId) : undefined;
  const names = cls ? cls.names : config.names;
  const rules: GroupRules = (cls ? cls.rules : config.rules) ?? emptyRules();
  const absent = config.absent ?? [];
  return {
    names,
    absent,
    /** Mená prítomných žiakov – z nich sa losuje a delí. */
    active: activeNames(names, absent),
    setAbsent(a: string[]) {
      update({ absent: normalizeAbsent(names, a) });
    },
    rules,
    cls,
    classes: rt.classes,
    setNames(n: string[]) {
      if (cls) rt.saveClass({ id: cls.id, name: cls.name, names: n });
      else update({ names: n, ...resetPatch });
    },
    setRules(r: GroupRules) {
      if (cls) rt.saveClass({ id: cls.id, name: cls.name, names: cls.names, rules: r });
      else update({ rules: r });
    },
    pickClass(id: string | null) {
      const c = id ? rt.classes.find((x) => x.id === id) : undefined;
      update({ classId: c ? c.id : null, names: c ? c.names : config.names, absent: [], ...resetPatch });
    },
    saveAsClass(name: string) {
      const id = rt.saveClass({ name, names: config.names, rules: config.rules });
      update({ classId: id, ...resetPatch });
    },
  };
}
