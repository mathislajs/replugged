import { toast } from "@common";
import { t as discordT, intl } from "@common/i18n";
import React from "@common/react";
import { Button, Divider, Flex, Notice, SliderItem, SwitchItem, Text, Tooltip } from "@components";
import { Logger } from "@replugged";
import { plugins } from "src/renderer/managers/plugins";
import { themes } from "src/renderer/managers/themes";
import {
  type UpdateSettings,
  checkAllUpdates,
  getAvailableUpdates,
  installAllUpdates,
  installUpdate,
  updaterSettings,
} from "src/renderer/managers/updater";
import { t } from "src/renderer/modules/i18n";
import { sleep, useSetting, useSettingArray } from "src/renderer/util";
import Icons from "../icons";
import { getAddonType, label } from "./Addons";

import "./Updater.css";

const logger = Logger.coremod("Settings:Updater");

export const Updater = (): React.ReactElement => {
  const [checking, setChecking] = React.useState(false);
  const [updatesAvailable, setUpdatesAvailable] =
    React.useState<Array<UpdateSettings & { id: string }>>(getAvailableUpdates());
  const [updatePromises, setUpdatePromises] = React.useState<Record<string, Promise<boolean>>>({});
  const [didInstallAll, setDidInstallAll] = React.useState(false);
  const [lastChecked, setLastChecked] = useSettingArray(updaterSettings, "lastChecked");

  React.useEffect(() => {
    const promises = Object.entries(updatePromises);

    let cancelled = false;

    promises.forEach(([id, promise]) => {
      promise
        .then(() => {
          if (cancelled) return;
          setUpdatePromises((prev) => {
            const { [id]: _, ...newPromises } = prev;
            return newPromises;
          });
          setUpdatesAvailable(getAvailableUpdates());
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          toast.toast("Update failed.", toast.Kind.FAILURE);
          logger.error(err);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [updatePromises]);

  const hasAnyUpdates = updatesAvailable.length > 0;
  const isAllUpdating = hasAnyUpdates && updatesAvailable.every((u) => u.id in updatePromises);
  const isAnyUpdating = hasAnyUpdates && updatesAvailable.some((u) => u.id in updatePromises);
  const isAllComplete = hasAnyUpdates && updatesAvailable.every((u) => !u.available);
  const isAnyComplete = hasAnyUpdates && updatesAvailable.some((u) => !u.available);
  const isRepluggedDev = window.RepluggedNative.getVersion() === "dev";

  const checkForUpdates = async (): Promise<void> => {
    const previousUpdates = getAvailableUpdates();
    setChecking(true);
    await Promise.all([checkAllUpdates(false, true), sleep(1000)]);
    setChecking(false);
    setLastChecked(Date.now());
    const newUpdates = getAvailableUpdates();
    setUpdatesAvailable(newUpdates);
    if (newUpdates.length > previousUpdates.length) {
      const count = newUpdates.length - previousUpdates.length;
      toast.toast(
        intl.formatToPlainString(t.REPLUGGED_UPDATES_TOAST_NEW, { count }),
        toast.Kind.SUCCESS,
      );
    } else {
      toast.toast(intl.string(t.REPLUGGED_UPDATES_TOAST_NO_NEW), toast.Kind.SUCCESS);
    }
  };

  const installAll = async (): Promise<void> => {
    setDidInstallAll(true);
    const promises = installAllUpdates(false, true);
    setUpdatePromises(promises);
    const statuses = await Promise.allSettled(Object.values(promises));
    const didAllSucceed = statuses.every((s) => s.status === "fulfilled" && s.value);
    if (didAllSucceed) {
      toast.toast(intl.string(t.REPLUGGED_UPDATES_TOAST_SUCCESS_ALL), toast.Kind.SUCCESS);
    } else {
      toast.toast(intl.string(t.REPLUGGED_UPDATES_TOAST_FAILED_ALL), toast.Kind.FAILURE);
    }
  };

  const installOne = async (id: string): Promise<void> => {
    setDidInstallAll(false);
    const promise = installUpdate(id, false, true);
    setUpdatePromises((prev) => ({ ...prev, [id]: promise }));
    const status = await promise.catch(() => false);
    if (status) {
      toast.toast(intl.string(t.REPLUGGED_UPDATES_TOAST_SUCCESS_ONE), toast.Kind.SUCCESS);
    } else {
      toast.toast(intl.string(t.REPLUGGED_UPDATES_TOAST_FAILED_ONE), toast.Kind.FAILURE);
    }
  };

  const reload = (): void => {
    window.DiscordNative.app.relaunch();
  };

  return (
    <>
      <Flex justify={Flex.Justify.BETWEEN} align={Flex.Align.START}>
        <Text.H2>{intl.string(t.REPLUGGED_UPDATES_UPDATER)}</Text.H2>
      </Flex>
      <Divider style={{ margin: "20px 0px" }} />
      <SwitchItem
        {...useSetting(updaterSettings, "autoCheck")}
        note={intl.string(t.REPLUGGED_UPDATES_OPTS_AUTO_DESC)}>
        {intl.string(t.REPLUGGED_UPDATES_OPTS_AUTO)}
      </SwitchItem>
      <SliderItem
        {...useSetting(updaterSettings, "checkIntervalMinutes")}
        disabled={!updaterSettings.get("autoCheck")}
        note={intl.string(t.REPLUGGED_UPDATES_OPTS_INTERVAL_DESC)}
        markers={[10, 20, 30, 40, 50, 60, 60 * 2, 60 * 3, 60 * 4, 60 * 5, 60 * 6, 60 * 12]}
        equidistant
        onMarkerRender={(value) => {
          // Format as xh and/or xm
          const hours = Math.floor(value / 60);
          const minutes = value % 60;

          const hourString =
            hours > 0 ? intl.formatToPlainString(discordT.DURATION_HOURS_SHORT, { hours }) : "";
          const minuteString =
            minutes > 0
              ? intl.formatToPlainString(discordT.DURATION_MINUTES_SHORT, { minutes })
              : "";

          const label = [hourString, minuteString].filter(Boolean).join(" ");
          return label;
        }}
        stickToMarkers>
        {intl.string(t.REPLUGGED_UPDATES_OPTS_INTERVAL)}
      </SliderItem>
      {isRepluggedDev && (
        <div style={{ marginBottom: "16px" }}>
          <Notice messageType={Notice.Types.WARNING}>
            {intl.format(t.REPLUGGED_DEVELOPER_MODE_WARNING, {
              url: "https://replugged.dev/download",
            })}
          </Notice>
        </div>
      )}
      <Flex
        justify={Flex.Justify.BETWEEN}
        align={Flex.Align.CENTER}
        className="replugged-updater-header">
        <Flex justify={Flex.Justify.CENTER} direction={Flex.Direction.VERTICAL}>
          <Text variant="heading-md/bold" color="header-primary">
            {updatesAvailable.length
              ? intl.format(t.REPLUGGED_UPDATES_AVAILABLE, { count: updatesAvailable.length })
              : intl.string(t.REPLUGGED_UPDATES_UP_TO_DATE)}
          </Text>
          {lastChecked ? (
            <Text.Normal style={{ marginTop: "5px" }}>
              {intl.format(t.REPLUGGED_UPDATES_LAST_CHECKED, {
                date: new Date(lastChecked).toLocaleString(intl.currentLocale),
              })}
            </Text.Normal>
          ) : null}
        </Flex>
        {!hasAnyUpdates ? (
          <Button
            className="replugged-updater-check"
            onClick={checkForUpdates}
            disabled={isAnyUpdating || isAnyComplete}
            color={checking ? Button.Colors.PRIMARY : Button.Colors.BRAND}
            submitting={checking}>
            {intl.string(t.REPLUGGED_UPDATES_CHECK)}
          </Button>
        ) : isAllComplete && didInstallAll ? (
          <Button onClick={reload} color={Button.Colors.RED}>
            {intl.string(t.REPLUGGED_UPDATES_AWAITING_RELOAD_TITLE)}
          </Button>
        ) : (
          <Button
            onClick={installAll}
            disabled={isAllComplete}
            color={isAllUpdating ? Button.Colors.PRIMARY : Button.Colors.BRAND}
            submitting={isAnyUpdating}>
            {intl.string(t.REPLUGGED_UPDATES_UPDATE_ALL)}
          </Button>
        )}
      </Flex>
      <Flex className="replugged-updater-items" direction={Flex.Direction.VERTICAL}>
        {updatesAvailable.map((update) => {
          const isReplugged = update.id === "dev.replugged.Replugged";
          const addon =
            plugins.get(update.id) ||
            themes.get(update.id) ||
            (isReplugged
              ? {
                  manifest: {
                    type: "replugged",
                    name: "Replugged",
                    version: window.RepluggedNative.getVersion(),
                  },
                }
              : null);
          const isUpdating = update.id in updatePromises;
          if (!addon) return null;
          const { manifest } = addon;
          const sourceLink = update.webUrl;
          return (
            <div className="replugged-updater-item" key={update.id}>
              <Flex justify={Flex.Justify.BETWEEN} align={Flex.Align.CENTER}>
                <div>
                  <Flex align={Flex.Align.CENTER} style={{ gap: "5px", marginBottom: "5px" }}>
                    <Text variant="heading-sm/normal" tag="h2" color="header-secondary">
                      <Text variant="heading-md/bold" color="header-primary" tag="span">
                        {manifest.name}
                      </Text>{" "}
                      v{manifest.version}
                    </Text>
                    {sourceLink ? (
                      <Tooltip
                        text={intl.formatToPlainString(t.REPLUGGED_ADDON_PAGE_OPEN, {
                          type: intl.string(discordT.UPDATE_BADGE_HEADER),
                        })}
                        className="replugged-addon-icon replugged-addon-icon-md">
                        <a href={sourceLink} target="_blank" rel="noopener noreferrer">
                          <Icons.Link />
                        </a>
                      </Tooltip>
                    ) : null}
                  </Flex>
                  <Text.Normal>
                    {intl.format(t.REPLUGGED_UPDATES_UPDATE_TO, { version: `v${update.version}` })}
                  </Text.Normal>
                </div>
                {update.available ? (
                  <Button
                    onClick={() => installOne(update.id)}
                    color={Button.Colors.PRIMARY}
                    submitting={isUpdating}>
                    {intl.string(discordT.UPDATE)}
                  </Button>
                ) : didInstallAll ? null : (
                  <Button onClick={reload} color={Button.Colors.RED}>
                    {intl.string(t.REPLUGGED_UPDATES_AWAITING_RELOAD_TITLE)}
                  </Button>
                )}
              </Flex>
              {manifest.type !== "replugged" && manifest.updater?.type !== "store" ? (
                <div style={{ marginTop: "8px" }}>
                  <Notice messageType={Notice.Types.ERROR}>
                    {intl.format(t.REPLUGGED_ADDON_NOT_REVIEWED_DESC, {
                      type: label(getAddonType(manifest.type)),
                    })}
                  </Notice>
                </div>
              ) : null}
            </div>
          );
        })}
      </Flex>
    </>
  );
};
